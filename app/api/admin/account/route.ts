import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { getOrganiser, setOrganiserEmail, setOrganiserPassword } from "@/lib/organisers";
import { hashPassword, verifyPassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { firstError, newPasswordSchema, optionalEmailSchema } from "@/lib/validation";

const schema = z.object({
  currentPassword: z.string().min(1, "Enter your current password").max(200),
  newPassword: newPasswordSchema.optional(),
  email: optionalEmailSchema.optional(),
});

/** Change the logged-in organiser's password and/or email. Always needs the current password. */
export async function PATCH(req: Request) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  if (!rateLimit(`account:${clientIp(req)}`, 10, 15 * 60_000)) {
    return NextResponse.json({ error: "Too many attempts. Wait 15 minutes and try again." }, { status: 429 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });

  const org = auth.session.organiserId ? await getOrganiser(auth.session.organiserId) : null;
  if (!org) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  if (!(await verifyPassword(parsed.data.currentPassword, org.password_hash))) {
    return NextResponse.json({ error: "Current password is wrong." }, { status: 401 });
  }
  if (parsed.data.newPassword) await setOrganiserPassword(org.id, await hashPassword(parsed.data.newPassword));
  if (parsed.data.email !== undefined) await setOrganiserEmail(org.id, parsed.data.email);
  return NextResponse.json({ ok: true });
}
