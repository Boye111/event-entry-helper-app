import "server-only";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession, type Role, type Session } from "./session";
import { getActiveUsher } from "./ushers";

/** Signature-checked session from the cookie, NOT re-validated against the DB. Prefer getActiveSession. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** A session that is still allowed right now. Ushers also carry the one event they may scan for. */
export type ActiveSession = Session & { eventId?: number };

/**
 * - admin: always (until cookie expiry / logout); picks the event per request
 * - usher: only while their row is active and hasn't been reset; locked to their event
 */
export async function getActiveSession(): Promise<ActiveSession | null> {
  const s = await getSession();
  if (!s || s.role === "admin") return s;
  if (s.usherId === undefined || s.usherVersion === undefined) return null; // old shared-PIN sessions
  const usher = await getActiveUsher(s.usherId, s.usherVersion);
  return usher ? { ...s, name: usher.name, eventId: usher.event_id } : null;
}

/**
 * Which event a scanner request works on: an usher's own event (whatever they ask for),
 * or for the admin the `requested` event id. Null = admin didn't pick a valid one.
 */
export function scanEventId(session: ActiveSession, requested: unknown): number | null {
  if (session.role === "usher") return session.eventId ?? null;
  const n = Number(requested);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function setSession(s: Session) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(s), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

type Guarded = { session: ActiveSession; error?: never } | { session?: never; error: NextResponse };

/** For route handlers: returns the session, or a 401/403 response. Admin can do anything an usher can. */
export async function requireRole(role: Role): Promise<Guarded> {
  const session = await getActiveSession();
  if (!session) return { error: NextResponse.json({ error: "Please log in." }, { status: 401 }) };
  if (role === "admin" && session.role !== "admin")
    return { error: NextResponse.json({ error: "Admins only." }, { status: 403 }) };
  return { session };
}
