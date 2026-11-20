import { NextResponse } from "next/server";
import Papa from "papaparse";
import { requireRole } from "@/lib/auth";
import { listGuests } from "@/lib/guests";
import { eventFromRoute, type IdCtx } from "@/lib/http";
import { inviteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: IdCtx) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  const { event, error } = await eventFromRoute(ctx);
  if (error) return error;
  const guests = await listGuests(event.id);
  const csv = Papa.unparse(
    guests.map((g) => ({
      name: g.name,
      phone: g.phone ?? "",
      email: g.email ?? "",
      seats: g.seats,
      side: g.side ?? "",
      table_no: g.table_no ?? "",
      code: g.code,
      invite_link: inviteUrl(g.code),
      checked_in_at: g.checked_in_at ? new Date(g.checked_in_at).toISOString() : "",
      checked_in_by: g.checked_in_by ?? "",
    })),
  );
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const slug = event.name.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "event";
  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-guests-${stamp}.csv"`,
    },
  });
}
