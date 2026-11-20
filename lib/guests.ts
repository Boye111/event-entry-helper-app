import "server-only";
import { sql } from "./db";
import { newGuestCode } from "./codes";
import type { CheckinResult, Guest, Stats } from "./types";

const COLS = sql`id, event_id, code, name, phone, email, seats, side, table_no, checked_in_at, checked_in_by, created_at`;

/**
 * The ONLY way a guest gets checked in. Single atomic conditional UPDATE —
 * safe under concurrent scans from multiple gates. Only admits guests of `eventId`.
 */
export async function checkIn(
  code: string,
  usher: { name: string; id: number | null },
  eventId: number,
): Promise<CheckinResult> {
  const updated = await sql<Guest[]>`
    UPDATE guests
    SET checked_in_at = now(), checked_in_by = ${usher.name}, checked_in_usher_id = ${usher.id}
    WHERE code = ${code} AND event_id = ${eventId} AND checked_in_at IS NULL
    RETURNING ${COLS}`;
  if (updated.length === 1) {
    const g = updated[0];
    return { status: "admitted", guest: g, checkedInAt: g.checked_in_at!, checkedInBy: g.checked_in_by! };
  }
  const existing = await getGuestByCode(code);
  if (!existing) return { status: "invalid" };
  // Don't reveal anything about another event's guest.
  if (existing.event_id !== eventId) return { status: "wrong_event" };
  if (!existing.checked_in_at) return { status: "invalid" };
  return {
    status: "already_used",
    guest: existing,
    checkedInAt: existing.checked_in_at,
    checkedInBy: existing.checked_in_by ?? "unknown",
  };
}

export async function getGuestByCode(code: string): Promise<Guest | null> {
  const rows = await sql<Guest[]>`SELECT ${COLS} FROM guests WHERE code = ${code}`;
  return rows[0] ?? null;
}

export async function listGuests(eventId: number): Promise<Guest[]> {
  return sql<Guest[]>`SELECT ${COLS} FROM guests WHERE event_id = ${eventId} ORDER BY lower(name)`;
}

export async function searchGuests(eventId: number, q: string, limit = 20): Promise<Guest[]> {
  const term = `%${q.replace(/[%_\\]/g, (c) => "\\" + c)}%`;
  const digits = q.replace(/\D/g, "");
  const phoneTerm = digits.length >= 4 ? `%${digits}%` : null;
  return sql<Guest[]>`
    SELECT ${COLS} FROM guests
    WHERE event_id = ${eventId} AND (
      name ILIKE ${term}
      OR (${phoneTerm}::text IS NOT NULL AND regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') LIKE ${phoneTerm})
    )
    ORDER BY lower(name)
    LIMIT ${limit}`;
}

export type GuestInput = {
  name: string;
  phone: string | null;
  email: string | null;
  seats: number;
  side: string | null;
  table_no: string | null;
};

export async function createGuest(eventId: number, g: GuestInput): Promise<Guest> {
  const [row] = await sql<Guest[]>`
    INSERT INTO guests (event_id, code, name, phone, email, seats, side, table_no)
    VALUES (${eventId}, ${newGuestCode()}, ${g.name}, ${g.phone}, ${g.email}, ${g.seats}, ${g.side}, ${g.table_no})
    RETURNING ${COLS}`;
  return row;
}

export async function createGuests(eventId: number, list: GuestInput[]): Promise<number> {
  if (list.length === 0) return 0;
  const rows = list.map((g) => ({ event_id: eventId, code: newGuestCode(), ...g }));
  await sql.begin(async (tx) => {
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      await tx`INSERT INTO guests ${tx(chunk, "event_id", "code", "name", "phone", "email", "seats", "side", "table_no")}`;
    }
  });
  return rows.length;
}

export async function updateGuest(id: number, g: GuestInput): Promise<Guest | null> {
  const rows = await sql<Guest[]>`
    UPDATE guests SET name = ${g.name}, phone = ${g.phone}, email = ${g.email}, seats = ${g.seats},
      side = ${g.side}, table_no = ${g.table_no}
    WHERE id = ${id}
    RETURNING ${COLS}`;
  return rows[0] ?? null;
}

export async function deleteGuest(id: number): Promise<boolean> {
  const rows = await sql`DELETE FROM guests WHERE id = ${id} RETURNING id`;
  return rows.length === 1;
}

export async function undoCheckIn(id: number): Promise<Guest | null> {
  const rows = await sql<Guest[]>`
    UPDATE guests SET checked_in_at = NULL, checked_in_by = NULL, checked_in_usher_id = NULL
    WHERE id = ${id}
    RETURNING ${COLS}`;
  return rows[0] ?? null;
}

export async function getStats(eventId: number): Promise<Stats> {
  const [row] = await sql<Stats[]>`
    SELECT
      count(*)::int AS guests,
      coalesce(sum(seats), 0)::int AS seats,
      count(checked_in_at)::int AS arrived_guests,
      coalesce(sum(seats) FILTER (WHERE checked_in_at IS NOT NULL), 0)::int AS arrived_seats
    FROM guests WHERE event_id = ${eventId}`;
  return row;
}
