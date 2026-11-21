import "server-only";
import { customAlphabet } from "nanoid";
import { CODE_ALPHABET } from "./codes";
import { sql } from "./db";

/** 16 chars from a 31-char alphabet ≈ 7e23 combinations: not guessable. */
export const newInviteToken = customAlphabet(CODE_ALPHABET, 16);
const TOKEN_RE = new RegExp(`^[${CODE_ALPHABET}]{16}$`);

export function isInviteTokenShape(token: string): boolean {
  return TOKEN_RE.test(token);
}

export type InviteStatus = "open" | "used" | "expired" | "revoked";
export type Invite = {
  id: number;
  token: string;
  label: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by_username: string | null;
  revoked_at: string | null;
  status: InviteStatus;
};

const STATUS = sql`CASE WHEN i.used_at IS NOT NULL THEN 'used' WHEN i.revoked_at IS NOT NULL THEN 'revoked'
  WHEN i.expires_at <= now() THEN 'expired' ELSE 'open' END`;
const COLS = sql`i.id, i.token, i.label, i.created_at, i.expires_at, i.used_at, i.revoked_at,
  (SELECT o.username FROM organisers o WHERE o.id = i.used_by) AS used_by_username, ${STATUS} AS status`;

/** eventId null = organiser sign-up links (super admin); a number = helper links for that event. */
export async function listInvites(eventId: number | null): Promise<Invite[]> {
  return sql<Invite[]>`
    SELECT ${COLS} FROM invites i
    WHERE ${eventId === null ? sql`i.event_id IS NULL` : sql`i.event_id = ${eventId}`}
    ORDER BY i.created_at DESC LIMIT 200`;
}

export async function createInvite(opts: {
  label: string;
  days: number;
  createdBy: number | null;
  eventId: number | null;
}): Promise<Invite> {
  const [row] = await sql<Invite[]>`
    INSERT INTO invites AS i (token, label, created_by, event_id, expires_at)
    VALUES (${newInviteToken()}, ${opts.label}, ${opts.createdBy}, ${opts.eventId}, now() + make_interval(days => ${opts.days}))
    RETURNING ${COLS}`;
  return row;
}

/** Cancels an unused invite. `eventId` scopes it (null = organiser sign-up links only). */
export async function revokeInvite(id: number, eventId: number | null): Promise<boolean> {
  const rows = await sql`
    UPDATE invites SET revoked_at = now()
    WHERE id = ${id} AND used_at IS NULL AND revoked_at IS NULL
      AND ${eventId === null ? sql`event_id IS NULL` : sql`event_id = ${eventId}`}
    RETURNING id`;
  return rows.length === 1;
}

export type InviteInfo = {
  status: InviteStatus;
  label: string;
  /** Set for helper invites */
  event_name: string | null;
  invited_by: string | null;
};

/** For the sign-up page: is this link usable, and what is it for? */
export async function inviteInfo(token: string): Promise<InviteInfo | null> {
  if (!isInviteTokenShape(token)) return null;
  const rows = await sql<InviteInfo[]>`
    SELECT ${STATUS} AS status, i.label, e.name AS event_name, o.username AS invited_by
    FROM invites i
    LEFT JOIN events e ON e.id = i.event_id
    LEFT JOIN organisers o ON o.id = i.created_by
    WHERE i.token = ${token}`;
  return rows[0] ?? null;
}
