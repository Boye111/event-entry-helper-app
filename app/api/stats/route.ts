import { NextResponse } from "next/server";
import { requireRole, scanEventId } from "@/lib/auth";
import { getStats } from "@/lib/guests";

export const dynamic = "force-dynamic";

/** ?event=<id> is only used by the admin; ushers always get their own event's numbers. */
export async function GET(req: Request) {
  const auth = await requireRole("usher");
  if (auth.error) return auth.error;
  const eventId = scanEventId(auth.session, new URL(req.url).searchParams.get("event"));
  if (!eventId) return NextResponse.json({ error: "Choose an event first." }, { status: 400 });
  return NextResponse.json(await getStats(eventId));
}
