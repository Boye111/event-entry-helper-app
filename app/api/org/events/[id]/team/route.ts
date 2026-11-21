import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEvent } from "@/lib/auth";
import { parseId, type IdCtx } from "@/lib/http";
import { createInvite, listInvites } from "@/lib/invites";
import { listHelpers } from "@/lib/organisers";
import { firstError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const schema = z.object({
  label: z.string().trim().min(1, "Say who the invite is for").max(80),
  days: z.coerce.number().int().min(1).max(30).default(7),
});

/** Helpers on this event and its helper invite links. Anyone on the event may look; only the owner changes it. */
export async function GET(_req: Request, ctx: IdCtx) {
  const auth = await requireEvent(await parseId(ctx));
  if (auth.error) return auth.error;
  const [helpers, invites] = await Promise.all([listHelpers(auth.event.id), listInvites(auth.event.id)]);
  return NextResponse.json({ helpers, invites: auth.access === "helper" ? [] : invites, canManage: auth.access !== "helper" });
}

/** New one-time helper invite link for this event. */
export async function POST(req: Request, ctx: IdCtx) {
  const auth = await requireEvent(await parseId(ctx), "manage");
  if (auth.error) return auth.error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  const invite = await createInvite({
    ...parsed.data,
    createdBy: auth.session.organiserId ?? null,
    eventId: auth.event.id,
  });
  return NextResponse.json({ invite }, { status: 201 });
}
