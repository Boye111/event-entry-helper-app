import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { parseId, type IdCtx } from "@/lib/http";
import { revokeInvite } from "@/lib/invites";

/** Cancels an unused invite link. */
export async function DELETE(_req: Request, ctx: IdCtx) {
  const auth = await requireRole("super");
  if (auth.error) return auth.error;
  const id = await parseId(ctx);
  if (!id || !(await revokeInvite(id, null))) {
    return NextResponse.json({ error: "Invite not found or already used." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
