import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createEvent, listEvents } from "@/lib/events";
import { eventSchema, firstError } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  return NextResponse.json({ events: await listEvents() });
}

export async function POST(req: Request) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  const parsed = eventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const e = parsed.data;
  const event = await createEvent({ ...e, event_date: e.event_date ? new Date(e.event_date).toISOString() : null });
  return NextResponse.json({ event }, { status: 201 });
}
