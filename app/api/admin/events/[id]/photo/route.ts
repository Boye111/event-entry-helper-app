import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { deleteEventPhoto, saveEventPhoto } from "@/lib/events";
import { parseId, type IdCtx } from "@/lib/http";

const MAX_BYTES = 3 * 1024 * 1024; // browser resizes first, so real uploads are ~200-500 KB

// Check the actual file bytes, not just the declared type.
function sniff(buf: Buffer): "image/jpeg" | "image/png" | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  return null;
}

export async function POST(req: Request, ctx: IdCtx) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo is too large (max 3 MB)." }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf);
  if (!type) return NextResponse.json({ error: "Please upload a JPG or PNG photo." }, { status: 400 });

  const version = await saveEventPhoto(id, buf, type);
  if (!version) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  return NextResponse.json({ version });
}

export async function DELETE(_req: Request, ctx: IdCtx) {
  const auth = await requireRole("admin");
  if (auth.error) return auth.error;
  const id = await parseId(ctx);
  if (!id) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  await deleteEventPhoto(id);
  return NextResponse.json({ ok: true });
}
