import { NextResponse } from "next/server";
import { z } from "zod";
import { safeEqual, setSession, superKey } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";

const schema = z.object({ password: z.string().min(1).max(200) });

/** Super admin login: ADMIN_PASSWORD only (no username). */
export async function POST(req: Request) {
  if (!rateLimit(`super-login:${clientIp(req)}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Wait 15 minutes and try again." }, { status: 429 });
  }
  const expected = process.env.ADMIN_PASSWORD;
  const key = superKey();
  if (!expected || !key) return NextResponse.json({ error: "ADMIN_PASSWORD is not set." }, { status: 500 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !safeEqual(parsed.data.password, expected)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  await setSession({ role: "super", name: "Super admin", superKey: key });
  return NextResponse.json({ ok: true });
}
