import type { Metadata } from "next";
import { EventPhoto } from "@/components/EventPhoto";
import { Ornament } from "@/components/Ornament";
import { ThemeToggle } from "@/components/ThemeToggle";
import { eventTitle, eventType } from "@/lib/eventTypes";
import { formatEventDate, formatEventTime, plural } from "@/lib/format";
import { loadInvite } from "@/lib/invite";
import { qrDataUrl } from "@/lib/qr";
import { inviteUrl } from "@/lib/site";

// READ-ONLY. This page must never check a guest in — only the usher scanner does that.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const data = await loadInvite(code);
  if (!data) return { title: "Invite not found", robots: { index: false } };
  const { guest, event } = data;
  const title = `${guest.name}, you're invited: ${eventTitle(event)}`;
  const description =
    [formatEventDate(event.event_date), event.venue].filter(Boolean).join(" · ") ||
    "Tap to view your invitation and entry QR code.";
  // Small landscape preview made for WhatsApp (absolute URL via metadataBase = NEXT_PUBLIC_SITE_URL).
  const image = { url: `/api/og/${code}`, width: 1200, height: 630, type: "image/png", alt: eventTitle(event) };
  return {
    title: { absolute: title },
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "website", url: inviteUrl(code), images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function InvitePage({ params }: Props) {
  const { code } = await params;
  const data = await loadInvite(code);

  if (!data) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-ivory px-6 text-center">
        <div className="max-w-sm">
          <h1 className="font-serif text-3xl">Invite not found</h1>
          <p className="mt-4 text-ink/70">
            We couldn&apos;t find this invitation. Please check the link you were sent, or contact the host.
          </p>
        </div>
      </main>
    );
  }

  const { guest, event: e } = data;
  const qr = await qrDataUrl(code, 720);
  const date = formatEventDate(e.event_date);
  const time = formatEventTime(e.event_date);
  const title = eventTitle(e);

  return (
    <main className="relative min-h-dvh bg-gradient-to-b from-ivory to-blush/60 px-5 py-10 sm:py-14 lg:flex lg:items-center">
      <ThemeToggle className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))]" />
      <div className="mx-auto w-full max-w-md text-center lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-center lg:gap-14">
        <div>
          <EventPhoto publicId={e.public_id} version={e.photo_version} alt={title} className="mb-8 h-72 w-52 sm:h-80 sm:w-60" />
          <p className="text-[11px] uppercase tracking-[0.3em] text-sage">{eventType(e.type).kicker}</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">{title}</h1>
          <Ornament className="my-6" />

          <p className="font-serif text-2xl italic">You&apos;re invited, {guest.name}</p>

          <div className="mt-6 space-y-1 text-ink/80">
            {date && <p className="font-medium text-ink">{date}</p>}
            {time && <p>{time}</p>}
            {e.venue && <p>{e.venue}</p>}
            {e.dress_code && (
              <p className="pt-2 text-sm">
                <span className="text-[11px] uppercase tracking-widest text-sage">Dress code · </span>
                {e.dress_code}
              </p>
            )}
          </div>
          {e.note && <p className="mt-8 hidden text-sm italic text-ink/70 lg:block">{e.note}</p>}
        </div>

        <div>
          <div className="mt-8 rounded-3xl bg-surface p-5 shadow-sm ring-1 ring-gold/20 lg:mt-0">
            {guest.checked_in_at ? (
              <div className="py-10">
                <p className="text-5xl">✓</p>
                <p className="mt-3 font-serif text-2xl">Checked in</p>
                <p className="mt-2 text-sm text-ink/60">Welcome! Enjoy the celebration.</p>
              </div>
            ) : (
              <>
                {/* QR keeps its own white background so it scans in dark mode too */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="Your entry QR code" className="mx-auto aspect-square w-full max-w-[340px] rounded-xl bg-white" />
                <p className="mt-3 font-medium">Show this QR at the gate</p>
                <p className="mt-1 text-sm text-ink/60">
                  Admits {plural(guest.seats, "person", "people")}
                  {guest.table_no ? ` · Table ${guest.table_no}` : ""}
                </p>
              </>
            )}
          </div>

          {!guest.checked_in_at && (
            <p className="mt-4 px-4 text-xs text-ink/50">
              Tip: take a screenshot of this page so you have your code even without internet. This code works once.
              Please don&apos;t share it.
            </p>
          )}
          {e.note && <p className="mt-8 text-sm italic text-ink/70 lg:hidden">{e.note}</p>}
        </div>
      </div>
    </main>
  );
}
