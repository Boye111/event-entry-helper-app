import { getEventPhoto } from "@/lib/events";

export const dynamic = "force-dynamic";

// Public event photo (shown on invites). URLs carry ?v=<version>, so a new upload gets a new URL.
export async function GET(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  if (!/^[0-9a-f]{16}$/.test(publicId)) return new Response("Not found", { status: 404 });
  const photo = await getEventPhoto(publicId);
  if (!photo) return new Response("No photo", { status: 404 });
  const versioned = new URL(req.url).searchParams.has("v");
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.type,
      "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=60",
    },
  });
}
