import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listOrganisers } from "@/lib/organisers";

export const dynamic = "force-dynamic";

/** Every organiser with their event / guest counts (no password hashes). */
export async function GET() {
  const auth = await requireRole("super");
  if (auth.error) return auth.error;
  return NextResponse.json({ organisers: await listOrganisers() });
}
