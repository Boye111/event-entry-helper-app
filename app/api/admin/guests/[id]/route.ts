import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { deleteGuest, updateGuest } from "@/lib/guests";
import { firstError, guestSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

async function parseId(ctx: Ctx) {
  const n = Number((await ctx.params).id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const parsed = guestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const guest = await updateGuest(id, parsed.data);
  if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  return NextResponse.json({ guest });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  if (!(await deleteGuest(id))) return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
