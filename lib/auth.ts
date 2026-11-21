import "server-only";
import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { sql } from "./db";
import { getEvent } from "./events";
import { getOrganiser, type OrganiserRole } from "./organisers";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession, type Session } from "./session";
import type { EventDetails } from "./types";
import { getActiveUsher } from "./ushers";

/** Signature-checked session from the cookie, NOT re-validated. Prefer getActiveSession. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** Fingerprint of ADMIN_PASSWORD kept in the super admin's cookie: a new password ends old sessions. */
export function superKey(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  return pw ? createHash("sha256").update(`super:${pw}`).digest("hex").slice(0, 32) : null;
}

/**
 * A session that is still allowed right now (checked on every request).
 * - organiser: account active and not reset; `accountRole` ("organiser" | "helper") comes from the DB
 * - usher: row active and not reset; locked to `eventId`
 * - super: ADMIN_PASSWORD unchanged since login
 */
export type ActiveSession = Session & { eventId?: number; accountRole?: OrganiserRole };

export async function getActiveSession(): Promise<ActiveSession | null> {
  const s = await getSession();
  if (!s) return null;
  if (s.role === "super") {
    const k = superKey();
    return k && s.superKey && safeEqual(s.superKey, k) ? s : null;
  }
  if (s.role === "organiser") {
    const org = await getOrganiser(s.organiserId!);
    if (!org || !org.active || org.version !== s.organiserVersion) return null;
    return { ...s, name: org.username, accountRole: org.role };
  }
  const usher = await getActiveUsher(s.usherId!, s.usherVersion!);
  return usher ? { ...s, name: usher.name, eventId: usher.event_id } : null;
}

/** How someone may use one event: super admin and owner can do everything; helpers can't delete or change helpers. */
export type EventAccess = "super" | "owner" | "helper";

export async function eventAccess(
  session: ActiveSession,
  eventId: number | null,
): Promise<{ event: EventDetails; access: EventAccess } | null> {
  if (session.role === "usher" || !eventId) return null;
  const event = await getEvent(eventId);
  if (!event) return null;
  if (session.role === "super") return { event, access: "super" };
  if (event.organiser_id === session.organiserId) return { event, access: "owner" };
  const rows = await sql`
    SELECT 1 FROM event_helpers WHERE event_id = ${event.id} AND organiser_id = ${session.organiserId!}`;
  return rows.length ? { event, access: "helper" } : null;
}

/**
 * Which event a scanner request works on: an usher's own event (whatever they ask for), or for an
 * organiser / helper / super admin the `requested` event, only if they may use it. Null = none.
 */
export async function scanEventId(session: ActiveSession, requested: unknown): Promise<number | null> {
  if (session.role === "usher") return session.eventId ?? null;
  const n = Number(requested);
  if (!Number.isInteger(n) || n <= 0) return null;
  return (await eventAccess(session, n))?.event.id ?? null;
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

/**
 * For route handlers: the session, or a 401/403 response.
 * "scan" = usher, account or super admin · "organiser" = a logged-in account · "super" = app owner.
 */
export async function requireRole(kind: "scan" | "organiser" | "super"): Promise<Guarded> {
  const session = await getActiveSession();
  if (!session) return { error: NextResponse.json({ error: "Please log in." }, { status: 401 }) };
  if (kind === "organiser" && session.role !== "organiser")
    return { error: NextResponse.json({ error: "Organisers only." }, { status: 403 }) };
  if (kind === "super" && session.role !== "super")
    return { error: NextResponse.json({ error: "Super admin only." }, { status: 403 }) };
  return { session };
}

type EventGuarded =
  | { session: ActiveSession; event: EventDetails; access: EventAccess; error?: never }
  | { session?: never; event?: never; access?: never; error: NextResponse };

const notFoundJson = (what: string) => NextResponse.json({ error: `${what} not found.` }, { status: 404 });
const ownerOnly = () => NextResponse.json({ error: "Only the event's owner can do this." }, { status: 403 });

/**
 * Route on one event. Someone else's event answers 404 (never reveals it exists).
 * need "manage" = owner or super admin only (delete event, change helpers).
 */
export async function requireEvent(eventId: number | null, need: "work" | "manage" = "work"): Promise<EventGuarded> {
  const session = await getActiveSession();
  if (!session) return { error: NextResponse.json({ error: "Please log in." }, { status: 401 }) };
  if (session.role === "usher") return { error: NextResponse.json({ error: "Organisers only." }, { status: 403 }) };
  const found = await eventAccess(session, eventId);
  if (!found) return { error: notFoundJson("Event") };
  if (need === "manage" && found.access === "helper") return { error: ownerOnly() };
  return { session, ...found };
}

/** Route on a guest or usher row: allowed if the row's event is one this person may work on. */
export async function requireRowOf(table: "guests" | "ushers", id: number | null): Promise<EventGuarded> {
  const what = table === "guests" ? "Guest" : "Usher";
  const rows = id ? await sql<{ event_id: number }[]>`SELECT event_id FROM ${sql(table)} WHERE id = ${id}` : [];
  if (!rows[0]) {
    const auth = await requireEvent(null); // still answer 401/403 first for people who aren't logged in
    return auth.error?.status === 404 ? { error: notFoundJson(what) } : auth;
  }
  const auth = await requireEvent(rows[0].event_id);
  return auth.error?.status === 404 ? { error: notFoundJson(what) } : auth;
}

/** Server pages for accounts (organisers and helpers): the session, or off to /login. */
export async function pageOrganiser(): Promise<ActiveSession> {
  const session = await getActiveSession();
  if (!session || session.role !== "organiser") redirect("/login");
  return session;
}

/** Server pages for the super admin: the session, or off to /admin/login. */
export async function pageSuper(): Promise<ActiveSession> {
  const session = await getActiveSession();
  if (!session || session.role !== "super") redirect("/admin/login");
  return session;
}

/** Server pages inside one event (organiser, helper or super admin). 404 if they may not use it. */
export async function pageEvent(id: string): Promise<{ session: ActiveSession; event: EventDetails; access: EventAccess }> {
  const session = await getActiveSession();
  if (!session || session.role === "usher") redirect("/login");
  const found = await eventAccess(session, Number(id));
  if (!found) notFound();
  return { session, ...found };
}
