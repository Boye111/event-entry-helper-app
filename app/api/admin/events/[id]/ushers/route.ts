import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { eventFromRoute, type IdCtx } from "@/lib/http";
import { createUsher, listUshers } from "@/lib/ushers";
import { firstError, usherSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: IdCtx) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  const { event, error } = await eventFromRoute(ctx);
  if (error) return error;
  return NextResponse.json({ ushers: await listUshers(event.id) });
}

export async function POST(req: Request, ctx: IdCtx) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  const { event, error } = await eventFromRoute(ctx);
  if (error) return error;
  const parsed = usherSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  return NextResponse.json({ usher: await createUsher(event.id, parsed.data) }, { status: 201 });
}
