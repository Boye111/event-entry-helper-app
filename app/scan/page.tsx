import { redirect } from "next/navigation";
import { Scanner } from "@/components/scanner/Scanner";
import { eventAccess, getActiveSession } from "@/lib/auth";
import { getEvent } from "@/lib/events";

export const metadata = { title: "Scanner", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Ushers scan for their own event. Organisers / helpers / super admin open /scan?event=<id> for an event they may use. */
export default async function ScanPage({ searchParams }: { searchParams: Promise<{ event?: string }> }) {
  const session = await getActiveSession();
  if (!session) redirect("/scan/login");

  const event =
    session.role === "usher"
      ? await getEvent(session.eventId!)
      : (await eventAccess(session, Number((await searchParams).event) || null))?.event;
  if (!event) redirect(session.role === "usher" ? "/scan/login" : session.role === "super" ? "/admin" : "/dashboard");

  return (
    <Scanner
      usherName={session.name}
      eventName={event.name}
      // Organisers send the event id; the server ignores it for ushers anyway.
      eventId={session.role === "usher" ? null : event.id}
      backHref={session.role === "usher" ? null : `/dashboard/events/${event.id}`}
    />
  );
}
