import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { isInviteTokenShape } from "@/lib/invites";
import { joinEventWithInvite } from "@/lib/organisers";

const schema = z.object({ token: z.string().refine(isInviteTokenShape) });

/** An existing account accepts a helper invite and is added to that event. */
export async function POST(req: Request) {
  const auth = await requireRole("organiser");
  if (auth.error) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "This invite link isn't valid." }, { status: 400 });
  const result = await joinEventWithInvite(parsed.data.token, auth.session.organiserId!);
  if ("error" in result) {
    return result.error === "owner"
      ? NextResponse.json({ error: "You already own this event." }, { status: 409 })
      : NextResponse.json({ error: "This invite link has already been used, expired or was cancelled." }, { status: 410 });
  }
  return NextResponse.json({ eventId: result.eventId });
}
