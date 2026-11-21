import { NextResponse } from "next/server";
import { requireRole, scanEventId } from "@/lib/auth";
import { searchGuests } from "@/lib/guests";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole("scan");
  if (auth.error) return auth.error;
  const params = new URL(req.url).searchParams;
  const eventId = await scanEventId(auth.session, params.get("event"));
  if (!eventId) return NextResponse.json({ error: "Choose an event first." }, { status: 400 });
  const q = (params.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ guests: [] });
  return NextResponse.json({ guests: await searchGuests(eventId, q) });
}
