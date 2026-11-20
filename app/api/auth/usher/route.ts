import { NextResponse } from "next/server";
import { z } from "zod";
import { safeEqual, setSession } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { getUsherByToken, markUsherLogin } from "@/lib/ushers";

// Ushers log in only through the personal link the organiser sends: { token, pin }.
const schema = z.object({ token: z.string().min(1).max(40), pin: z.string().min(1).max(20) });

const TOO_MANY = { error: "Too many attempts. Wait 15 minutes and try again." };

export async function POST(req: Request) {
  if (!rateLimit(`usher-login:${clientIp(req)}`, 10, 15 * 60_000)) {
    return NextResponse.json(TOO_MANY, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Open the personal scanner link the organiser sent you." }, { status: 400 });
  }
  // Per-link limit too, so a leaked link can't be brute-forced from many IPs.
  if (!rateLimit(`usher-link:${parsed.data.token}`, 8, 15 * 60_000)) {
    return NextResponse.json(TOO_MANY, { status: 429 });
  }
  const usher = await getUsherByToken(parsed.data.token);
  if (!usher || !usher.active) {
    return NextResponse.json({ error: "This scanner link is no longer active. Ask the organiser." }, { status: 401 });
  }
  if (!safeEqual(parsed.data.pin, usher.pin)) {
    return NextResponse.json({ error: "Wrong PIN." }, { status: 401 });
  }
  await markUsherLogin(usher.id);
  await setSession({ role: "usher", name: usher.name, usherId: usher.id, usherVersion: usher.version });
  return NextResponse.json({ ok: true });
}
