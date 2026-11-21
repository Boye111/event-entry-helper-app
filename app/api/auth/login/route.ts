import { NextResponse } from "next/server";
import { z } from "zod";
import { setSession } from "@/lib/auth";
import { getOrganiserByUsername, markOrganiserLogin } from "@/lib/organisers";
import { burnPasswordCheck, verifyPassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/ratelimit";

const schema = z.object({ username: z.string().trim().min(1).max(40), password: z.string().min(1).max(200) });

/** Organiser / helper login with username + password. */
export async function POST(req: Request) {
  if (!rateLimit(`admin-login:${clientIp(req)}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Wait 15 minutes and try again." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });

  const { username, password } = parsed.data;
  const org = await getOrganiserByUsername(username);
  const ok = org ? await verifyPassword(password, org.password_hash) : (await burnPasswordCheck(password), false);
  if (!org || !ok) return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
  if (!org.active) {
    return NextResponse.json({ error: "This account has been turned off. Contact the app owner." }, { status: 403 });
  }

  await markOrganiserLogin(org.id);
  await setSession({ role: "organiser", name: org.username, organiserId: org.id, organiserVersion: org.version });
  return NextResponse.json({ ok: true });
}
