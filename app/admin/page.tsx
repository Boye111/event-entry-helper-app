import Link from "next/link";
import { AdminHeader, LocalUrlBanner } from "@/components/admin/AdminHeader";
import { card, primaryBtn } from "@/components/admin/styles";
import { eventType } from "@/lib/eventTypes";
import { listEvents } from "@/lib/events";
import { formatEventDate, plural } from "@/lib/format";
import { siteUrl, siteUrlIsLocal } from "@/lib/site";

export const metadata = { title: "Your events", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const events = await listEvents();

  return (
    <div className="min-h-dvh bg-ivory">
      <AdminHeader />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {siteUrlIsLocal() && <LocalUrlBanner siteUrl={siteUrl()} />}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl">Your events</h1>
            <p className="mt-1 text-sm text-ink/60">Each event has its own guests, ushers and scanner.</p>
          </div>
          <Link href="/admin/events/new" className={primaryBtn}>
            + New event
          </Link>
        </div>

        {events.length === 0 ? (
          <div className={`${card} p-10 text-center`}>
            <p className="font-serif text-2xl">No events yet</p>
            <p className="mt-2 text-ink/60">Create your first event, then add guests and ushers to it.</p>
            <Link href="/admin/events/new" className={`${primaryBtn} mt-6`}>
              Create an event
            </Link>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => {
              const pct = e.seats ? Math.round((e.arrived_seats / e.seats) * 100) : 0;
              return (
                <li key={e.id}>
                  <Link
                    href={`/admin/events/${e.id}`}
                    className={`${card} block h-full p-5 transition hover:ring-ink/25 hover:shadow-sm`}
                  >
                    <p className="text-xs uppercase tracking-wider text-sage">{eventType(e.type).label}</p>
                    <p className="mt-1 font-serif text-xl leading-snug">{e.name}</p>
                    <p className="mt-1 text-sm text-ink/60">
                      {[formatEventDate(e.event_date) ?? "No date yet", e.venue].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-4 text-sm tabular-nums">
                      <b>{plural(e.guests, "invite")}</b> · {e.seats} people · {e.arrived_guests} arrived
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10">
                      <div className="h-full bg-sage" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
