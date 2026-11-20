import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createGuests, type GuestInput } from "@/lib/guests";
import { eventFromRoute, type IdCtx } from "@/lib/http";
import { guestSchema } from "@/lib/validation";

const schema = z.object({ rows: z.array(z.unknown()).min(1).max(5000) });

export async function POST(req: Request, ctx: IdCtx) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  const { event, error } = await eventFromRoute(ctx);
  if (error) return error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "No rows to import." }, { status: 400 });

  const valid: GuestInput[] = [];
  const errors: string[] = [];
  parsed.data.rows.forEach((row, i) => {
    const r = guestSchema.safeParse(row);
    if (r.success) valid.push(r.data);
    else errors.push(`Row ${i + 2}: ${r.error.issues[0]?.message}`);
  });
  if (errors.length) return NextResponse.json({ error: "Fix these rows first.", errors }, { status: 400 });

  return NextResponse.json({ imported: await createGuests(event.id, valid) });
}
