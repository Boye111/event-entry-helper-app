import { redirect } from "next/navigation";
import { Scanner } from "@/components/scanner/Scanner";
import { getActiveSession } from "@/lib/auth";
import { getEvent } from "@/lib/events";

export const metadata = { title: "Scanner", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Ushers scan for their own event. The admin opens /scan?event=<id> from an event's tabs. */
export default async function ScanPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const session = await getActiveSession();
  if (!session) redirect("/scan/login");

  const requested = session.role === "usher" ? session.eventId : Number((await searchParams).event);
  const event = requested ? await getEvent(requested) : null;
  if (!event) redirect(session.role === "admin" ? "/admin" : "/scan/login");

  return (
    <Scanner
      usherName={session.name}
      eventName={event.name}
      // Only the admin sends an event id; the server ignores it for ushers anyway.
      eventId={session.role === "admin" ? event.id : null}
      backHref={session.role === "admin" ? `/admin/events/${event.id}` : null}
    />
  );
}
