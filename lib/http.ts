import "server-only";

export type IdCtx = { params: Promise<{ id: string }> };

export async function parseId(ctx: IdCtx): Promise<number | null> {
  const n = Number((await ctx.params).id);
  return Number.isInteger(n) && n > 0 ? n : null;
}
