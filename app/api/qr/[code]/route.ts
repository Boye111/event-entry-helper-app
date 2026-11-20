import { NextResponse } from "next/server";
import { isValidCodeShape } from "@/lib/codes";
import { qrPng } from "@/lib/qr";

// Public: only reveals the code the holder already has. Does NOT check anyone in.
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isValidCodeShape(code)) return new NextResponse("Not found", { status: 404 });
  const png = await qrPng(code, 800);
  const download = new URL(req.url).searchParams.has("download");
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
      ...(download ? { "Content-Disposition": `attachment; filename="qr-${code}.png"` } : {}),
    },
  });
}
