import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { deleteUsher, setUsherActive } from "@/lib/ushers";
import { usherPatchSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

async function parseId(ctx: Ctx) {
  const n = Number((await ctx.params).id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** { active: false } turns the usher off (logs them out); { active: true } lets them log in again. */
export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const parsed = usherPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  if (!(await setUsherActive(id, parsed.data.active))) {
    return NextResponse.json({ error: "Usher not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  if (!(await deleteUsher(id))) return NextResponse.json({ error: "Usher not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
