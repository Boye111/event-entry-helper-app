import { NextResponse } from "next/server";
import { requireRole, scanEventId } from "@/lib/auth";
import { extractCode } from "@/lib/codes";
import { checkIn } from "@/lib/guests";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { checkinSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireRole("usher");
  if (auth.error) return auth.error;

  // Generous: a busy gate might scan ~1/sec, but stops scripted guessing.
  if (!rateLimit(`checkin:${clientIp(req)}`, 120, 60_000)) {
    return NextResponse.json({ error: "Too many scans too fast. Wait a moment." }, { status: 429 });
  }

  const parsed = checkinSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ status: "invalid" });

  const eventId = scanEventId(auth.session, parsed.data.eventId);
  if (!eventId) return NextResponse.json({ error: "Choose an event first." }, { status: 400 });

  const code = extractCode(parsed.data.code);
  if (!code) return NextResponse.json({ status: "invalid" });

  try {
    const name = auth.session.name || (auth.session.role === "admin" ? "Admin" : "Usher");
    return NextResponse.json(await checkIn(code, { name, id: auth.session.usherId ?? null }, eventId));
  } catch (e) {
    console.error("checkin failed", e);
    return NextResponse.json({ error: "Server problem. Try again, or use manual search." }, { status: 500 });
  }
}
