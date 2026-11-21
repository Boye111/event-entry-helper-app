import "server-only";
import type { TransactionSql } from "postgres";
import { sql } from "./db";

/** "organiser" can create events; "helper" only works on events they've been added to. */
export type OrganiserRole = "organiser" | "helper";
export type Organiser = {
  id: number;
  username: string;
  email: string | null;
  password_hash: string;
  role: OrganiserRole;
  active: boolean;
  version: number;
};

const COLS = sql`id, username, email, password_hash, role, active, version`;

export async function getOrganiserByUsername(username: string): Promise<Organiser | null> {
  const rows = await sql<Organiser[]>`SELECT ${COLS} FROM organisers WHERE username = ${username.trim().toLowerCase()}`;
  return rows[0] ?? null;
}

export async function getOrganiser(id: number): Promise<Organiser | null> {
  if (!Number.isInteger(id)) return null;
  const rows = await sql<Organiser[]>`SELECT ${COLS} FROM organisers WHERE id = ${id}`;
  return rows[0] ?? null;
}

class InviteError extends Error {
  constructor(public kind: "invite" | "username" | "owner") {
    super(kind);
  }
}

type Tx = TransactionSql<Record<string, never>>;

/** Uses up an open invite (conditional UPDATE, so one link can never be used twice, even at the same moment). */
async function claimInvite(tx: Tx, token: string) {
  const [invite] = await tx<{ id: number; event_id: number | null }[]>`
    UPDATE invites SET used_at = now()
    WHERE token = ${token} AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
    RETURNING id, event_id`;
  if (!invite) throw new InviteError("invite");
  return invite;
}

export type SignupResult = { organiser: Organiser } | { error: "invite" | "username" };

/**
 * New account from an invite, in one transaction. A super admin invite makes an organiser; an event
 * invite makes a helper on that event. A taken username rolls back, so the invite stays usable.
 */
export async function signupWithInvite(
  token: string,
  username: string,
  email: string,
  passwordHash: string,
): Promise<SignupResult> {
  try {
    return await sql.begin(async (tx) => {
      const invite = await claimInvite(tx, token);
      const role: OrganiserRole = invite.event_id ? "helper" : "organiser";
      const [org] = await tx<Organiser[]>`
        INSERT INTO organisers (username, email, password_hash, role, invite_id)
        VALUES (${username.toLowerCase()}, ${email}, ${passwordHash}, ${role}, ${invite.id})
        ON CONFLICT (username) DO NOTHING
        RETURNING ${COLS}`;
      if (!org) throw new InviteError("username");
      await tx`UPDATE invites SET used_by = ${org.id} WHERE id = ${invite.id}`;
      if (invite.event_id) {
        await tx`INSERT INTO event_helpers (event_id, organiser_id) VALUES (${invite.event_id}, ${org.id})`;
      }
      return { organiser: org };
    });
  } catch (e) {
    if (e instanceof InviteError && e.kind !== "owner") return { error: e.kind };
    throw e;
  }
}

/** Someone who already has an account accepts a helper invite. Returns the event id, or an error. */
export async function joinEventWithInvite(
  token: string,
  organiserId: number,
): Promise<{ eventId: number } | { error: "invite" | "owner" }> {
  try {
    return await sql.begin(async (tx) => {
      const invite = await claimInvite(tx, token);
      if (!invite.event_id) throw new InviteError("invite"); // organiser invites are for new accounts only
      const [ev] = await tx<{ organiser_id: number | null }[]>`SELECT organiser_id FROM events WHERE id = ${invite.event_id}`;
      if (ev?.organiser_id === organiserId) throw new InviteError("owner");
      await tx`UPDATE invites SET used_by = ${organiserId} WHERE id = ${invite.id}`;
      await tx`
        INSERT INTO event_helpers (event_id, organiser_id) VALUES (${invite.event_id}, ${organiserId})
        ON CONFLICT DO NOTHING`;
      return { eventId: invite.event_id };
    });
  } catch (e) {
    if (e instanceof InviteError && e.kind !== "username") return { error: e.kind };
    throw e;
  }
}

export async function markOrganiserLogin(id: number) {
  await sql`UPDATE organisers SET last_login_at = now() WHERE id = ${id}`;
}

/** `logoutEverywhere` bumps the version, which ends every session of this account (used for resets). */
export async function setOrganiserPassword(id: number, passwordHash: string, logoutEverywhere = false) {
  await sql`
    UPDATE organisers SET password_hash = ${passwordHash},
      version = CASE WHEN ${logoutEverywhere} THEN version + 1 ELSE version END
    WHERE id = ${id}`;
}

export async function setOrganiserEmail(id: number, email: string | null) {
  await sql`UPDATE organisers SET email = ${email} WHERE id = ${id}`;
}

// ---------------------------------------------------------------- helpers on an event

export type Helper = { id: number; username: string; email: string | null; added_at: string };

export async function listHelpers(eventId: number): Promise<Helper[]> {
  return sql<Helper[]>`
    SELECT o.id, o.username, o.email, h.added_at
    FROM event_helpers h JOIN organisers o ON o.id = h.organiser_id
    WHERE h.event_id = ${eventId} ORDER BY h.added_at`;
}

export async function removeHelper(eventId: number, organiserId: number): Promise<boolean> {
  const rows = await sql`
    DELETE FROM event_helpers WHERE event_id = ${eventId} AND organiser_id = ${organiserId} RETURNING event_id`;
  return rows.length === 1;
}

// ---------------------------------------------------------------- super admin

export type OrganiserSummary = {
  id: number;
  username: string;
  email: string | null;
  role: OrganiserRole;
  active: boolean;
  created_at: string;
  last_login_at: string | null;
  invite_label: string | null;
  events: number;
  helping: number;
  guests: number;
  arrived: number;
};

export async function listOrganisers(): Promise<OrganiserSummary[]> {
  return sql<OrganiserSummary[]>`
    SELECT o.id, o.username, o.email, o.role, o.active, o.created_at, o.last_login_at, i.label AS invite_label,
      (SELECT count(*)::int FROM events e WHERE e.organiser_id = o.id) AS events,
      (SELECT count(*)::int FROM event_helpers h WHERE h.organiser_id = o.id) AS helping,
      (SELECT count(*)::int FROM guests g JOIN events e ON e.id = g.event_id WHERE e.organiser_id = o.id) AS guests,
      (SELECT count(g.checked_in_at)::int FROM guests g JOIN events e ON e.id = g.event_id WHERE e.organiser_id = o.id) AS arrived
    FROM organisers o LEFT JOIN invites i ON i.id = o.invite_id
    ORDER BY o.role, o.created_at`;
}

/** Turning off also logs them out everywhere. */
export async function setOrganiserActive(id: number, active: boolean): Promise<boolean> {
  const rows = await sql`UPDATE organisers SET active = ${active}, version = version + 1 WHERE id = ${id} RETURNING id`;
  return rows.length === 1;
}

/** Super admin: let a helper create their own events (or take that away). */
export async function setOrganiserRole(id: number, role: OrganiserRole): Promise<boolean> {
  const rows = await sql`UPDATE organisers SET role = ${role} WHERE id = ${id} RETURNING id`;
  return rows.length === 1;
}

/** Deletes the account with all events it OWNS (their guests and ushers too). Helper places just go. */
export async function deleteOrganiser(id: number): Promise<boolean> {
  const rows = await sql`DELETE FROM organisers WHERE id = ${id} RETURNING id`;
  return rows.length === 1;
}

export type AppStats = {
  organisers: number;
  helpers: number;
  active_accounts: number;
  events: number;
  unowned_events: number;
  upcoming_events: number;
  guests: number;
  seats: number;
  arrived: number;
  arrived_7d: number;
  ushers: number;
  open_invites: number;
};

export async function appStats(): Promise<AppStats> {
  const [r] = await sql<AppStats[]>`
    SELECT
      (SELECT count(*)::int FROM organisers WHERE role = 'organiser') AS organisers,
      (SELECT count(*)::int FROM organisers WHERE role = 'helper') AS helpers,
      (SELECT count(*)::int FROM organisers WHERE active) AS active_accounts,
      (SELECT count(*)::int FROM events) AS events,
      (SELECT count(*)::int FROM events WHERE organiser_id IS NULL) AS unowned_events,
      (SELECT count(*)::int FROM events WHERE event_date >= now() - interval '1 day') AS upcoming_events,
      (SELECT count(*)::int FROM guests) AS guests,
      (SELECT coalesce(sum(seats), 0)::int FROM guests) AS seats,
      (SELECT count(checked_in_at)::int FROM guests) AS arrived,
      (SELECT count(*)::int FROM guests WHERE checked_in_at >= now() - interval '7 days') AS arrived_7d,
      (SELECT count(*)::int FROM ushers) AS ushers,
      (SELECT count(*)::int FROM invites WHERE event_id IS NULL AND used_at IS NULL AND revoked_at IS NULL
         AND expires_at > now()) AS open_invites`;
  return r;
}
