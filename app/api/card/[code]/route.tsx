import { ImageResponse } from "next/og";
import { eventTitle, eventType } from "@/lib/eventTypes";
import { formatEventDate, formatEventTime, plural } from "@/lib/format";
import { eventPhotoDataUrl, loadInvite, serifFonts } from "@/lib/invite";
import { qrDataUrl } from "@/lib/qr";

export const dynamic = "force-dynamic";

// Invite card image (1080x1350, portrait - looks good in WhatsApp). Public, read-only, never checks in.
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const data = await loadInvite(code);
  if (!data) return new Response("Not found", { status: 404 });
  const { guest, event: s } = data;

  const [qr, photoSrc, fonts] = await Promise.all([qrDataUrl(code, 520), eventPhotoDataUrl(s), serifFonts()]);

  const date = formatEventDate(s.event_date);
  const time = formatEventTime(s.event_date);
  const download = new URL(req.url).searchParams.has("download");
  // With a photo, tighten the layout so the QR still stays large enough to scan.
  const qrSize = photoSrc ? 360 : 440;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: "linear-gradient(180deg, #faf7f2 0%, #f3e3dc 100%)",
          color: "#2b2622",
          fontFamily: "Serif",
          fontWeight: 500,
          fontStyle: "normal",
          padding: 60,
        }}
      >
        <div
          style={{
            flex: 1,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "3px solid rgba(176,141,87,0.55)",
            borderRadius: 32,
            padding: photoSrc ? "40px 48px" : "56px 48px",
          }}
        >
          {photoSrc && (
            <div
              style={{
                display: "flex",
                width: 210,
                height: 270,
                borderRadius: "105px 105px 12px 12px",
                overflow: "hidden",
                border: "3px solid rgba(176,141,87,0.55)",
                marginBottom: 28,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoSrc} width={210} height={270} alt="" style={{ objectFit: "cover" }} />
            </div>
          )}
          <div style={{ fontSize: 26, letterSpacing: 8, color: "#7d8f7a", textTransform: "uppercase" }}>
            {eventType(s.type).kicker}
          </div>
          <div style={{ fontSize: photoSrc ? 68 : 84, marginTop: 18, textAlign: "center", lineHeight: 1.1 }}>
            {eventTitle(s)}
          </div>
          <div style={{ width: 160, height: 2, background: "#b08d57", margin: photoSrc ? "22px 0" : "30px 0" }} />
          <div style={{ fontSize: 44, fontStyle: "italic", fontWeight: 400 }}>{`Dear ${guest.name},`}</div>
          <div style={{ fontSize: 30, marginTop: 18, textAlign: "center", color: "#4a423c", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {date && <span>{`${date}${time ? ` · ${time}` : ""}`}</span>}
            {s.venue && <span style={{ marginTop: 6 }}>{s.venue}</span>}
          </div>
          <div style={{ display: "flex", background: "white", padding: 18, borderRadius: 24, marginTop: photoSrc ? 26 : 36 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} width={qrSize} height={qrSize} alt="" />
          </div>
          <div style={{ fontSize: 28, marginTop: 24 }}>
            {`Show this QR at the gate · Admits ${plural(guest.seats, "person", "people")}`}
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts,
      headers: download
        ? { "Content-Disposition": `attachment; filename="invite-${guest.name.replace(/[^\w-]+/g, "-")}.png"` }
        : { "Cache-Control": "public, max-age=300" },
    },
  );
}
