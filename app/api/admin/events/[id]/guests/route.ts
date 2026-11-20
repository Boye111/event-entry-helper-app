import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { createGuest, listGuests } from "@/lib/guests";
import { eventFromRoute, type IdCtx } from "@/lib/http";
import { firstError, guestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: IdCtx) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  const { event, error } = await eventFromRoute(ctx);
  if (error) return error;
  return NextResponse.json({ guests: await listGuests(event.id) });
}

export async function POST(req: Request, ctx: IdCtx) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  const { event, error } = await eventFromRoute(ctx);
  if (error) return error;
  const parsed = guestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  return NextResponse.json({ guest: await createGuest(event.id, parsed.data) }, { status: 201 });
}
