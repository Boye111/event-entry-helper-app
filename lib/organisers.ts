import "server-only";
import { sql } from "./db";

export type Organiser = { id: number; username: string; email: string | null; password_hash: string };

export async function hasOrganisers(): Promise<boolean> {
  const [r] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM organisers`;
  return r.n > 0;
}

export async function getOrganiserByUsername(username: string): Promise<Organiser | null> {
  const rows = await sql<Organiser[]>`
    SELECT id, username, email, password_hash FROM organisers WHERE username = ${username.toLowerCase()}`;
  return rows[0] ?? null;
}

export async function getOrganiser(id: number): Promise<Organiser | null> {
  const rows = await sql<Organiser[]>`SELECT id, username, email, password_hash FROM organisers WHERE id = ${id}`;
  return rows[0] ?? null;
}

/** Creates the FIRST organiser only. Returns null if one already exists (so setup can't be replayed). */
export async function createFirstOrganiser(username: string, email: string | null, passwordHash: string) {
  const rows = await sql<Organiser[]>`
    INSERT INTO organisers (username, email, password_hash)
    SELECT ${username.toLowerCase()}, ${email}, ${passwordHash}
    WHERE NOT EXISTS (SELECT 1 FROM organisers)
    RETURNING id, username, email, password_hash`;
  return rows[0] ?? null;
}

export async function markOrganiserLogin(id: number) {
  await sql`UPDATE organisers SET last_login_at = now() WHERE id = ${id}`;
}

export async function setOrganiserPassword(id: number, passwordHash: string) {
  await sql`UPDATE organisers SET password_hash = ${passwordHash} WHERE id = ${id}`;
}

export async function setOrganiserEmail(id: number, email: string | null) {
  await sql`UPDATE organisers SET email = ${email} WHERE id = ${id}`;
}
