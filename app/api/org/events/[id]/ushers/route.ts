import { NextResponse } from "next/server";
import { requireEvent } from "@/lib/auth";
import { parseId, type IdCtx } from "@/lib/http";
import { createUsher, listUshers } from "@/lib/ushers";
import { firstError, usherSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: IdCtx) {
  const { event, error } = await requireEvent(await parseId(ctx));
  if (error) return error;
  return NextResponse.json({ ushers: await listUshers(event.id) });
}

export async function POST(req: Request, ctx: IdCtx) {
  const { event, error } = await requireEvent(await parseId(ctx));
  if (error) return error;
  const parsed = usherSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
  return NextResponse.json({ usher: await createUsher(event.id, parsed.data) }, { status: 201 });
}
