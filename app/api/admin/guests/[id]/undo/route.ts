import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { undoCheckIn } from "@/lib/guests";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  const guest = await undoCheckIn(id);
  if (!guest) return NextResponse.json({ error: "Guest not found" }, { status: 404 });
  return NextResponse.json({ guest });
}
