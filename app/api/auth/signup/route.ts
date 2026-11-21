import { NextResponse } from "next/server";
import { z } from "zod";
import { setSession } from "@/lib/auth";
import { isInviteTokenShape } from "@/lib/invites";
import { signupWithInvite } from "@/lib/organisers";
import { hashPassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { firstError, newPasswordSchema, usernameSchema } from "@/lib/validation";

const schema = z.object({
  token: z.string().refine(isInviteTokenShape, "This invite link isn't valid."),
  username: usernameSchema,
  email: z.string().trim().toLowerCase().max(200).pipe(z.email("Enter a valid email address")),
  password: newPasswordSchema,
});

/** New account from a one-time invite link: organiser (from the super admin) or helper (from an organiser). */
export async function POST(req: Request) {
  if (!rateLimit(`signup:${clientIp(req)}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Wait 15 minutes and try again." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const { token, username, email, password } = parsed.data;

  const result = await signupWithInvite(token, username, email, await hashPassword(password));
  if ("error" in result) {
    return result.error === "username"
      ? NextResponse.json({ error: "That username is taken. Pick another one." }, { status: 409 })
      : NextResponse.json({ error: "This invite link has already been used, expired or was cancelled." }, { status: 410 });
  }
  const org = result.organiser;
  await setSession({ role: "organiser", name: org.username, organiserId: org.id, organiserVersion: org.version });
  return NextResponse.json({ ok: true }, { status: 201 });
}
