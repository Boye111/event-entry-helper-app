import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminHeader, LocalUrlBanner } from "@/components/admin/AdminHeader";
import { DeleteEvent } from "@/components/admin/DeleteEvent";
import { card, pillMuted, primaryBtn } from "@/components/admin/styles";
import { getActiveSession, pageOrganiser } from "@/lib/auth";
import { eventType } from "@/lib/eventTypes";
import { listEvents } from "@/lib/events";
import { formatEventDate, plural } from "@/lib/format";
import { siteUrl, siteUrlIsLocal } from "@/lib/siteUrl";

export const metadata = { title: "Your events", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Events this account owns, plus events it helps with. */
export default async function EventsPage() {
  if ((await getActiveSession())?.role === "super") redirect("/admin");
  const session = await pageOrganiser();
  const events = await listEvents(session.organiserId!);
  const canCreate = session.accountRole === "organiser";

  return (
    <div className="min-h-dvh bg-ivory">
      <AdminHeader />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {siteUrlIsLocal() && <LocalUrlBanner siteUrl={siteUrl()} />}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-serif text-3xl">Your events</h1>
            <p className="mt-1 text-sm text-ink/60">
              {canCreate
                ? "Each event has its own guests, ushers, team and scanner."
                : "Events you've been invited to help with."}
            </p>
          </div>
          {canCreate && (
            <Link href="/dashboard/events/new" className={primaryBtn}>
              + New event
            </Link>
          )}
        </div>

        {events.length === 0 ? (
          <div className={`${card} p-10 text-center`}>
            <p className="font-serif text-2xl">No events yet</p>
            {canCreate ? (
              <>
                <p className="mt-2 text-ink/60">Create your first event, then add guests and ushers to it.</p>
                <Link href="/dashboard/events/new" className={`${primaryBtn} mt-6`}>
                  Create an event
                </Link>
              </>
            ) : (
              <p className="mt-2 text-ink/60">When an organiser adds you to their event, it shows up here.</p>
            )}
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => {
              const pct = e.seats ? Math.round((e.arrived_seats / e.seats) * 100) : 0;
              return (
                <li key={e.id} className={`${card} flex flex-col transition hover:ring-ink/25 hover:shadow-sm`}>
                  <Link href={`/dashboard/events/${e.id}`} className="block flex-1 p-5 pb-3">
                    <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-sage">
                      {eventType(e.type).label}
                      {e.access === "helper" && <span className={`${pillMuted} normal-case tracking-normal`}>Helping {e.owner}</span>}
                    </p>
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
                  {e.access === "owner" && (
                    <div className="border-t border-ink/5 px-3 py-2">
                      <DeleteEvent eventId={e.id} eventName={e.name} compact />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
