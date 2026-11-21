import { customAlphabet } from "nanoid";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { CODE_ALPHABET } from "@/lib/codes";
import { parseId, type IdCtx } from "@/lib/http";
import { getOrganiser, setOrganiserPassword } from "@/lib/organisers";
import { hashPassword } from "@/lib/password";

const tempPassword = customAlphabet(CODE_ALPHABET, 10);

/**
 * Manual "forgot password": sets a temporary password, logs the organiser out everywhere, and returns
 * the password ONCE so the super admin can send it. The organiser should change it under Account.
 */
export async function POST(_req: Request, ctx: IdCtx) {
  const auth = await requireRole("super");
  if (auth.error) return auth.error;
  const id = await parseId(ctx);
  const org = id ? await getOrganiser(id) : null;
  if (!org) return NextResponse.json({ error: "Organiser not found." }, { status: 404 });
  const password = tempPassword();
  await setOrganiserPassword(org.id, await hashPassword(password), true);
  return NextResponse.json({ username: org.username, password });
}
