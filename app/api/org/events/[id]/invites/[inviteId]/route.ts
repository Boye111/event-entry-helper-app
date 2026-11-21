import { NextResponse } from "next/server";
import { requireEvent } from "@/lib/auth";
import { parseId } from "@/lib/http";
import { revokeInvite } from "@/lib/invites";

type Ctx = { params: Promise<{ id: string; inviteId: string }> };

/** Cancels an unused helper invite link of this event. Owner / super admin only. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const p = await params;
  const auth = await requireEvent(await parseId({ params: Promise.resolve({ id: p.id }) }), "manage");
  if (auth.error) return auth.error;
  const inviteId = Number(p.inviteId);
  if (!Number.isInteger(inviteId) || !(await revokeInvite(inviteId, auth.event.id))) {
    return NextResponse.json({ error: "Invite not found or already used." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
