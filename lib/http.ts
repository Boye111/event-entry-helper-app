import "server-only";
import { NextResponse } from "next/server";
import { getEvent } from "./events";
import type { EventDetails } from "./types";

export type IdCtx = { params: Promise<{ id: string }> };

export async function parseId(ctx: IdCtx): Promise<number | null> {
  const n = Number((await ctx.params).id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Loads the event from the route's [id], or returns a 404 response. */
export async function eventFromRoute(
  ctx: IdCtx,
): Promise<{ event: EventDetails; error?: never } | { event?: never; error: NextResponse }> {
  const id = await parseId(ctx);
  const event = id ? await getEvent(id) : null;
  if (!event) return { error: NextResponse.json({ error: "Event not found." }, { status: 404 }) };
  return { event };
}
