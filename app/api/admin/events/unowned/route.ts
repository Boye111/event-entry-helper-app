import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { deleteUnownedEvents } from "@/lib/events";

const schema = z.object({ confirm: z.literal("DELETE") });

/** Deletes all events without an owner, with their guests and ushers. Body must be { confirm: "DELETE" }. */
export async function POST(req: Request) {
  const auth = await requireRole("super");
  if (auth.error) return auth.error;
  if (!schema.safeParse(await req.json().catch(() => null)).success) {
    return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });
  }
  return NextResponse.json({ deleted: await deleteUnownedEvents() });
}
