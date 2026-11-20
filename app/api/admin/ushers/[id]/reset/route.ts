import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { resetUsher } from "@/lib/ushers";

/** New link + new PIN. The old link stops working and the usher is logged out. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  if (!(await resetUsher(id))) return NextResponse.json({ error: "Usher not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
