import { NextResponse } from "next/server";
import { z } from "zod";
import { safeEqual, setSession } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";

const schema = z.object({ password: z.string().min(1).max(200) });

export async function POST(req: Request) {
  if (!rateLimit(`admin-login:${clientIp(req)}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Wait 15 minutes and try again." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return NextResponse.json({ error: "ADMIN_PASSWORD is not configured." }, { status: 500 });
  if (!parsed.success || !safeEqual(parsed.data.password, expected)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  await setSession({ role: "admin", name: "Admin" });
  return NextResponse.json({ ok: true });
}
