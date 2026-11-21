import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEvent } from "@/lib/auth";
import { deleteGuests } from "@/lib/guests";
import { parseId, type IdCtx } from "@/lib/http";

const schema = z.union([
  z.object({ ids: z.array(z.number().int().positive()).min(1).max(5000) }),
  z.object({ all: z.literal(true) }),
]);

/** Bulk delete: { ids: [...] } for selected guests, or { all: true } for every guest of this event. */
export async function POST(req: Request, ctx: IdCtx) {
  const { event, error } = await requireEvent(await parseId(ctx));
  if (error) return error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose guests to delete." }, { status: 400 });
  const deleted = await deleteGuests(event.id, "ids" in parsed.data ? parsed.data.ids : null);
  return NextResponse.json({ deleted });
}
