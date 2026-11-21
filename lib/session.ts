// Edge-safe session helpers (used by middleware and server code).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "wedding_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * - organiser: a logged-in account (organiser or helper). organiserId + organiserVersion.
 * - usher:     a personal scanner link + PIN. usherId + usherVersion.
 * - super:     the app owner, logged in at /admin with ADMIN_PASSWORD. superKey = fingerprint of that password,
 *              so changing ADMIN_PASSWORD logs the super admin out everywhere.
 * Everything is re-checked against the DB / env on every request (lib/auth.ts). The middleware only checks
 * the signature.
 */
export type Role = "organiser" | "usher" | "super";
export type Session = {
  role: Role;
  name: string;
  organiserId?: number;
  organiserVersion?: number;
  usherId?: number;
  usherVersion?: number;
  superKey?: string;
};

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(secret);
}

export async function signSession(s: Session): Promise<string> {
  return new SignJWT({
    role: s.role,
    name: s.name,
    oid: s.organiserId,
    ov: s.organiserVersion,
    uid: s.usherId,
    uv: s.usherVersion,
    sk: s.superKey,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload: p } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const name = typeof p.name === "string" ? p.name : "";
    if (p.role === "organiser" && typeof p.oid === "number" && typeof p.ov === "number") {
      return { role: "organiser", name, organiserId: p.oid, organiserVersion: p.ov };
    }
    if (p.role === "usher" && typeof p.uid === "number" && typeof p.uv === "number") {
      return { role: "usher", name, usherId: p.uid, usherVersion: p.uv };
    }
    if (p.role === "super" && typeof p.sk === "string") return { role: "super", name: "Super admin", superKey: p.sk };
    return null; // older cookie formats: log in again
  } catch {
    return null;
  }
}
