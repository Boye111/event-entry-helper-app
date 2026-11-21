import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createEvent, listEvents } from "@/lib/events";
import { eventSchema, firstError } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Events this account owns or helps with (the super admin sees all events on /admin). */
export async function GET() {
  const auth = await requireRole("organiser");
  if (auth.error) return auth.error;
  return NextResponse.json({ events: await listEvents(auth.session.organiserId!) });
}

/** Only "organiser" accounts create events; helpers work on events they were added to. */
export async function POST(req: Request) {
  const auth = await requireRole("organiser");
  if (auth.error) return auth.error;
  if (auth.session.accountRole !== "organiser") {
    return NextResponse.json({ error: "Helper accounts can't create events. Ask the app owner." }, { status: 403 });
  }
  const parsed = eventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const e = parsed.data;
  const event = await createEvent(auth.session.organiserId!, { ...e, event_date: e.event_date ? new Date(e.event_date).toISOString() : null });
  return NextResponse.json({ event }, { status: 201 });
}
