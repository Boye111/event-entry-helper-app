import "server-only";
import { randomInt } from "node:crypto";
import { customAlphabet } from "nanoid";
import { CODE_ALPHABET } from "./codes";
import { sql } from "./db";
import type { Usher } from "./types";

// Scanner-link tokens: same look-alike-free alphabet as guest codes, but longer. 31^16 ≈ 7e23.
export const USHER_TOKEN_LENGTH = 16;
const newToken = customAlphabet(CODE_ALPHABET, USHER_TOKEN_LENGTH);
const TOKEN_RE = new RegExp(`^[${CODE_ALPHABET}]{${USHER_TOKEN_LENGTH}}$`);

export const isValidUsherToken = (t: string) => TOKEN_RE.test(t);
const newPin = () => randomInt(0, 1_000_000).toString().padStart(6, "0");

const COLS = sql`u.id, u.event_id, u.token, u.name, u.phone, u.pin, u.active, u.version, u.last_login_at, u.created_at`;

export async function listUshers(eventId: number): Promise<Usher[]> {
  return sql<Usher[]>`
    SELECT ${COLS}, (SELECT count(*)::int FROM guests g WHERE g.checked_in_usher_id = u.id) AS admitted
    FROM ushers u WHERE u.event_id = ${eventId} ORDER BY u.created_at`;
}

export async function createUsher(eventId: number, input: { name: string; phone: string | null }): Promise<Usher> {
  const [row] = await sql<Usher[]>`
    INSERT INTO ushers AS u (event_id, token, name, phone, pin)
    VALUES (${eventId}, ${newToken()}, ${input.name}, ${input.phone}, ${newPin()})
    RETURNING ${COLS}, 0 AS admitted`;
  return row;
}

/** Turning an usher off bumps `version`, so turning them back on still requires a fresh login. */
export async function setUsherActive(id: number, active: boolean): Promise<boolean> {
  const rows = await sql`
    UPDATE ushers SET active = ${active}, version = version + CASE WHEN ${active} THEN 0 ELSE 1 END
    WHERE id = ${id} RETURNING id`;
  return rows.length === 1;
}

/** New link + new PIN; the old link stops working and the usher's phone is logged out. */
export async function resetUsher(id: number): Promise<boolean> {
  const rows = await sql`
    UPDATE ushers SET token = ${newToken()}, pin = ${newPin()}, version = version + 1
    WHERE id = ${id} RETURNING id`;
  return rows.length === 1;
}

export async function deleteUsher(id: number): Promise<boolean> {
  // Guests they admitted keep `checked_in_by` (the name); only the link to this row is cleared.
  const rows = await sql`DELETE FROM ushers WHERE id = ${id} RETURNING id`;
  return rows.length === 1;
}

export async function getUsherByToken(token: string) {
  if (!isValidUsherToken(token)) return null;
  const rows = await sql<
    { id: number; name: string; pin: string; active: boolean; version: number; event_name: string; event_title: string | null }[]
  >`
    SELECT u.id, u.name, u.pin, u.active, u.version, e.name AS event_name, e.hosts AS event_title
    FROM ushers u JOIN events e ON e.id = u.event_id WHERE u.token = ${token}`;
  return rows[0] ?? null;
}

export async function markUsherLogin(id: number) {
  await sql`UPDATE ushers SET last_login_at = now() WHERE id = ${id}`;
}

/** Used on every usher request: is this session's usher still active and not reset? */
export async function getActiveUsher(id: number, version: number) {
  const rows = await sql<{ name: string; event_id: number }[]>`
    SELECT name, event_id FROM ushers WHERE id = ${id} AND version = ${version} AND active`;
  return rows[0] ?? null;
}
