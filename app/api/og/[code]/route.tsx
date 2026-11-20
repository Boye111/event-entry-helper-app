import { ImageResponse } from "next/og";
import { eventTitle, eventType } from "@/lib/eventTypes";
import { formatEventDate } from "@/lib/format";
import { eventPhotoDataUrl, loadInvite, serifFonts } from "@/lib/invite";

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
  const [photo, fonts] = await Promise.all([eventPhotoDataUrl(event), serifFonts()]);
  const when = [formatEventDate(event.event_date), event.venue].filter(Boolean).join(" · ");

  return new ImageResponse(
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
              width: 340,
              height: 460,
              flexShrink: 0,
              borderRadius: "170px 170px 16px 16px",
              overflow: "hidden",
              border: "4px solid rgba(176,141,87,0.6)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} width={340} height={460} alt="" style={{ objectFit: "cover" }} />
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
    { width: 1200, height: 630, fonts, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
