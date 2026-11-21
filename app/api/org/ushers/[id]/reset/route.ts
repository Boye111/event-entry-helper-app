import { NextResponse } from "next/server";
import { requireRowOf } from "@/lib/auth";
import { resetUsher } from "@/lib/ushers";

/** New link + new PIN. The old link stops working and the usher is logged out. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const n = Number((await params).id);
  const id = Number.isInteger(n) && n > 0 ? n : null;
  const auth = await requireRowOf("ushers", id);
  if (auth.error) return auth.error;
  if (!(await resetUsher(id!))) return NextResponse.json({ error: "Usher not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
