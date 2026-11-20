import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { deleteEvent, updateEvent } from "@/lib/events";
import { parseId, type IdCtx } from "@/lib/http";
import { eventSchema, firstError } from "@/lib/validation";

export async function PATCH(req: Request, ctx: IdCtx) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const parsed = eventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const e = parsed.data;
  const event = await updateEvent(id, { ...e, event_date: e.event_date ? new Date(e.event_date).toISOString() : null });
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  return NextResponse.json({ event });
}

/** Deletes the event with ALL its guests and ushers. The UI makes the organiser type the name first. */
export async function DELETE(_req: Request, ctx: IdCtx) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  if (!(await deleteEvent(id))) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
