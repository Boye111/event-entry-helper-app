import { ImageResponse } from "next/og";
import { eventTitle, eventType } from "@/lib/eventTypes";
import { formatEventDate } from "@/lib/format";
import { fitInside } from "@/lib/imageSize";
import { eventPhotoForImage, loadInvite, serifFonts } from "@/lib/invite";

export const dynamic = "force-dynamic";

/**
 * Link-preview thumbnail for WhatsApp / iMessage / Facebook (1200x630).
 * Deliberately has NO QR code: it stays small (WhatsApp drops previews over ~300 KB),
 * and the QR only shows once the guest opens their link. Read-only, never checks in.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await loadInvite(code);
  if (!data) return new Response("Not found", { status: 404 });
  const { guest, event } = data;
  const [photo, fonts] = await Promise.all([eventPhotoForImage(event), serifFonts()]);
  // Couple photo or flyer: shown whole (never cropped), at most 360x500.
  const box = fitInside(photo?.size ?? null, 360, 500);
  const when = [formatEventDate(event.event_date), event.venue].filter(Boolean).join(" · ");

  const png = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 56,
          padding: "56px 72px",
          background: "linear-gradient(135deg, #faf7f2 0%, #f3e3dc 100%)",
          color: "#2b2622",
          fontFamily: "Serif",
          // Without these, the font matcher picks the italic face for every line.
          fontWeight: 500,
          fontStyle: "normal",
        }}
      >
        {photo && (
          <div
            style={{
              display: "flex",
              flexShrink: 0,
              borderRadius: 20,
              overflow: "hidden",
              border: "4px solid rgba(176,141,87,0.6)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.src} width={box.width} height={box.height} alt="" />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, alignItems: photo ? "flex-start" : "center" }}>
          <div style={{ fontSize: 26, letterSpacing: 7, textTransform: "uppercase", color: "#7d8f7a" }}>
            {eventType(event.type).kicker}
          </div>
          <div
            style={{
              fontSize: photo ? 72 : 88,
              lineHeight: 1.05,
              marginTop: 16,
              textAlign: photo ? "left" : "center",
              fontWeight: 500,
            }}
          >
            {eventTitle(event)}
          </div>
          <div style={{ width: 140, height: 3, background: "#b08d57", margin: "28px 0" }} />
          <div style={{ fontSize: 40, fontStyle: "italic", fontWeight: 400 }}>{`${guest.name}, you're invited`}</div>
          {when && <div style={{ fontSize: 28, marginTop: 16, color: "#4a423c" }}>{when}</div>}
          <div style={{ fontSize: 24, marginTop: 28, color: "#7d8f7a" }}>Tap to open your invitation & entry QR</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts },
  );
  return toJpeg(png);
}

/**
 * next/og only makes PNGs, which are huge for photos (600 KB+); WhatsApp skips previews over
 * ~300 KB. Re-encode as JPEG (~50-150 KB). Falls back to the PNG if sharp isn't available.
 */
async function toJpeg(png: ImageResponse): Promise<Response> {
  const buf = Buffer.from(await png.arrayBuffer());
  const headers = { "Cache-Control": "public, max-age=300" };
  try {
    const sharp = (await import("sharp")).default;
    const jpg = await sharp(buf).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    return new Response(new Uint8Array(jpg), { headers: { ...headers, "Content-Type": "image/jpeg" } });
  } catch (e) {
    console.error("og: jpeg conversion failed, sending png", e);
    // Short reason in a header so a failing deploy can be diagnosed with curl -I.
    const reason = String(e instanceof Error ? e.message : e).replace(/[^\x20-\x7e]/g, " ").slice(0, 160);
    return new Response(new Uint8Array(buf), {
      headers: { ...headers, "Content-Type": "image/png", "X-Og-Fallback": reason },
    });
  }
}
