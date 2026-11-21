import { NextResponse } from "next/server";
import { requireRowOf } from "@/lib/auth";
import { undoCheckIn } from "@/lib/guests";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const n = Number((await params).id);
  const id = Number.isInteger(n) && n > 0 ? n : null;
  const auth = await requireRowOf("guests", id);
  if (auth.error) return auth.error;
  const guest = await undoCheckIn(id!);
  if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  return NextResponse.json({ guest });
}
