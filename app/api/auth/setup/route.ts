import { NextResponse } from "next/server";
import { z } from "zod";
import { safeEqual, setSession } from "@/lib/auth";
import { createFirstOrganiser, hasOrganisers } from "@/lib/organisers";
import { hashPassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { firstError, newPasswordSchema, optionalEmailSchema, usernameSchema } from "@/lib/validation";

const schema = z.object({
  setupPassword: z.string().min(1, "Enter the setup password").max(200),
  username: usernameSchema,
  email: optionalEmailSchema,
  password: newPasswordSchema,
});

/**
 * One-time creation of the first organiser account. Needs ADMIN_PASSWORD (the "setup password" from
 * Vercel) so only whoever deployed the app can claim it. Refused once any account exists.
 */
export async function POST(req: Request) {
  if (!rateLimit(`setup:${clientIp(req)}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Wait 15 minutes and try again." }, { status: 429 });
  }
  if (await hasOrganisers()) {
    return NextResponse.json({ error: "An organiser account already exists. Log in instead." }, { status: 409 });
  }
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return NextResponse.json({ error: "ADMIN_PASSWORD is not set in Vercel." }, { status: 500 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const { setupPassword, username, email, password } = parsed.data;
  if (!safeEqual(setupPassword, expected)) {
    return NextResponse.json({ error: "Setup password is wrong. It is the ADMIN_PASSWORD you set in Vercel." }, { status: 401 });
  }

  const org = await createFirstOrganiser(username, email, await hashPassword(password));
  if (!org) return NextResponse.json({ error: "An organiser account already exists. Log in instead." }, { status: 409 });
  await setSession({ role: "admin", name: org.username, organiserId: org.id });
  return NextResponse.json({ ok: true });
}
