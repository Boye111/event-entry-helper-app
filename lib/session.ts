// Edge-safe session helpers (used by middleware and server code).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "wedding_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type Role = "admin" | "usher";
/**
 * usherId/usherVersion are set for ushers who logged in with their personal link.
 * They are re-checked against the DB on every request (see lib/auth.ts), so deactivating
 * or resetting an usher logs them out immediately. The middleware only checks the signature.
 * Admin sessions carry organiserId (the logged-in organiser account); old password-only sessions are rejected.
 */
export type Session = { role: Role; name: string; organiserId?: number; usherId?: number; usherVersion?: number };

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(secret);
}

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({ role: s.role, name: s.name, oid: s.organiserId, uid: s.usherId, uv: s.usherVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (payload.role !== "admin" && payload.role !== "usher") return null;
    const s: Session = { role: payload.role, name: typeof payload.name === "string" ? payload.name : "" };
    if (payload.role === "admin") {
      if (typeof payload.oid !== "number") return null; // from before username login existed
      s.organiserId = payload.oid;
    }
    if (typeof payload.uid === "number" && typeof payload.uv === "number") {
      s.usherId = payload.uid;
      s.usherVersion = payload.uv;
    }
    return s;
  } catch {
    return null;
  }
}
