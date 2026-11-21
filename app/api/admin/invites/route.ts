import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createInvite, listInvites } from "@/lib/invites";
import { firstError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const schema = z.object({
  label: z.string().trim().min(1, "Say who the invite is for").max(80),
  days: z.coerce.number().int().min(1).max(90).default(7),
});

export async function GET() {
  const auth = await requireRole("super");
  if (auth.error) return auth.error;
  return NextResponse.json({ invites: await listInvites(null) });
}

/** One-time sign-up link for a new organiser. */
export async function POST(req: Request) {
  const auth = await requireRole("super");
  if (auth.error) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const invite = await createInvite({ ...parsed.data, createdBy: null, eventId: null });
  return NextResponse.json({ invite }, { status: 201 });
}
