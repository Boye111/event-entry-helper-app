import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { parseId, type IdCtx } from "@/lib/http";
import { deleteOrganiser, setOrganiserActive, setOrganiserRole } from "@/lib/organisers";

const schema = z.union([z.object({ active: z.boolean() }), z.object({ role: z.enum(["organiser", "helper"]) })]);

/**
 * { active: false } turns the account off and logs them out everywhere; { active: true } turns it back on.
 * { role: "organiser" } lets a helper create their own events; { role: "helper" } takes that away.
 */
export async function PATCH(req: Request, ctx: IdCtx) {
  const auth = await requireRole("super");
  if (auth.error) return auth.error;
  const id = await parseId(ctx);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const d = parsed.data;
  const ok = id && ("active" in d ? await setOrganiserActive(id, d.active) : await setOrganiserRole(id, d.role));
  if (!ok) {
    return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/** Deletes the organiser with ALL their events, guests and ushers. The UI makes you type DELETE. */
export async function DELETE(_req: Request, ctx: IdCtx) {
  const auth = await requireRole("super");
  if (auth.error) return auth.error;
  const id = await parseId(ctx);
  if (!id || !(await deleteOrganiser(id))) {
    return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
