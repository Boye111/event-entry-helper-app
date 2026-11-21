import { NextResponse } from "next/server";
import { requireEvent } from "@/lib/auth";
import { parseId } from "@/lib/http";
import { removeHelper } from "@/lib/organisers";

type Ctx = { params: Promise<{ id: string; helperId: string }> };

/** Removes a helper from this event (their account stays). Owner / super admin only. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const p = await params;
  const auth = await requireEvent(await parseId({ params: Promise.resolve({ id: p.id }) }), "manage");
  if (auth.error) return auth.error;
  const helperId = Number(p.helperId);
  if (!Number.isInteger(helperId) || !(await removeHelper(auth.event.id, helperId))) {
    return NextResponse.json({ error: "Helper not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
