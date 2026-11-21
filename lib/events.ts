import "server-only";
import { sql } from "./db";
import type { EventDetails, EventSummary } from "./types";

const COLS = sql`e.id, e.organiser_id, e.public_id, e.name, e.type, e.hosts, e.event_date, e.venue, e.dress_code, e.note,
  e.photo_version::text AS photo_version, e.created_at`;

export type EventInput = {
  name: string;
  type: string;
  hosts: string | null;
  event_date: string | null;
  venue: string | null;
  dress_code: string | null;
  note: string | null;
};

export type EventRow = EventSummary & { owner: string | null; access: "owner" | "helper" | "super" };

/**
 * Events with guest counts, soonest upcoming first, then past events.
 * `organiserId` = events that account owns or helps with; null = every event (super admin).
 */
export async function listEvents(organiserId: number | null): Promise<EventRow[]> {
  const access =
    organiserId === null
      ? sql`'super'`
      : sql`CASE WHEN e.organiser_id = ${organiserId} THEN 'owner' ELSE 'helper' END`;
  return sql<EventRow[]>`
    SELECT ${COLS}, (SELECT o.username FROM organisers o WHERE o.id = e.organiser_id) AS owner, ${access} AS access,
      count(g.id)::int AS guests,
      coalesce(sum(g.seats), 0)::int AS seats,
      count(g.checked_in_at)::int AS arrived_guests,
      coalesce(sum(g.seats) FILTER (WHERE g.checked_in_at IS NOT NULL), 0)::int AS arrived_seats
    FROM events e LEFT JOIN guests g ON g.event_id = e.id
    WHERE ${
      organiserId === null
        ? sql`true`
        : sql`(e.organiser_id = ${organiserId}
            OR EXISTS (SELECT 1 FROM event_helpers h WHERE h.event_id = e.id AND h.organiser_id = ${organiserId}))`
    }
    GROUP BY e.id
    ORDER BY (e.event_date IS NULL OR e.event_date < now() - interval '1 day'), e.event_date, e.created_at DESC`;
}

export async function getEvent(id: number): Promise<EventDetails | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const rows = await sql<EventDetails[]>`SELECT ${COLS} FROM events e WHERE e.id = ${id}`;
  return rows[0] ?? null;
}

export async function createEvent(organiserId: number, e: EventInput): Promise<EventDetails> {
  const [row] = await sql<EventDetails[]>`
    INSERT INTO events AS e (organiser_id, name, type, hosts, event_date, venue, dress_code, note)
    VALUES (${organiserId}, ${e.name}, ${e.type}, ${e.hosts}, ${e.event_date}, ${e.venue}, ${e.dress_code}, ${e.note})
    RETURNING ${COLS}`;
  return row;
}

export async function updateEvent(id: number, e: EventInput): Promise<EventDetails | null> {
  const rows = await sql<EventDetails[]>`
    UPDATE events AS e SET name = ${e.name}, type = ${e.type}, hosts = ${e.hosts}, event_date = ${e.event_date},
      venue = ${e.venue}, dress_code = ${e.dress_code}, note = ${e.note}
    WHERE e.id = ${id}
    RETURNING ${COLS}`;
  return rows[0] ?? null;
}

/** Deletes the event AND all its guests and ushers (ON DELETE CASCADE). */
export async function deleteEvent(id: number): Promise<boolean> {
  const rows = await sql`DELETE FROM events WHERE id = ${id} RETURNING id`;
  return rows.length === 1;
}

/** Super admin: hand an event (with its guests and ushers) to another organiser. */
export async function moveEvent(id: number, organiserId: number): Promise<boolean> {
  const rows = await sql`
    UPDATE events SET organiser_id = ${organiserId}
    WHERE id = ${id} AND EXISTS (SELECT 1 FROM organisers WHERE id = ${organiserId}) RETURNING id`;
  return rows.length === 1;
}

export async function getEventPhoto(publicId: string): Promise<{ data: Buffer; type: string } | null> {
  const rows = await sql<{ photo: Buffer | null; photo_type: string | null }[]>`
    SELECT photo, photo_type FROM events WHERE public_id = ${publicId}`;
  const r = rows[0];
  return r?.photo && r.photo_type ? { data: r.photo, type: r.photo_type } : null;
}

export async function saveEventPhoto(id: number, data: Buffer, type: string): Promise<string | null> {
  const version = Date.now().toString();
  const rows = await sql`
    UPDATE events SET photo = ${data}, photo_type = ${type}, photo_version = ${version}
    WHERE id = ${id} RETURNING id`;
  return rows.length ? version : null;
}

export async function deleteEventPhoto(id: number): Promise<void> {
  await sql`UPDATE events SET photo = NULL, photo_type = NULL, photo_version = NULL WHERE id = ${id}`;
}
