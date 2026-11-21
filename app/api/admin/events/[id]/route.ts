import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { moveEvent } from "@/lib/events";
import { parseId, type IdCtx } from "@/lib/http";

const schema = z.object({ organiserId: z.number().int().positive() });

/** Hands an event (with its guests and ushers) to another organiser. */
export async function PATCH(req: Request, ctx: IdCtx) {
  const auth = await requireRole("super");
  if (auth.error) return auth.error;
  const id = await parseId(ctx);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose an organiser." }, { status: 400 });
  if (!id || !(await moveEvent(id, parsed.data.organiserId))) {
    return NextResponse.json({ error: "Event or organiser not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
