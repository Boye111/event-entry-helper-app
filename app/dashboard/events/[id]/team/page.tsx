import { AdminHeader } from "@/components/admin/AdminHeader";
import { Team } from "@/components/admin/Team";
import { pageEvent } from "@/lib/auth";
import { listInvites } from "@/lib/invites";
import { getOrganiser, listHelpers } from "@/lib/organisers";

export const metadata = { title: "Team", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The event's owner and helpers. The owner (or super admin) invites and removes helpers. */
export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, event, access } = await pageEvent((await params).id);
  const canManage = access !== "helper";
  const [helpers, invites, owner] = await Promise.all([
    listHelpers(event.id),
    canManage ? listInvites(event.id) : Promise.resolve([]),
    event.organiser_id ? getOrganiser(event.organiser_id) : Promise.resolve(null),
  ]);
  return (
    <div className="min-h-dvh bg-ivory">
      <AdminHeader event={event} viewer={session.role === "super" ? "super" : "organiser"} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <h1 className="font-serif text-3xl">Team</h1>
          <p className="mt-1 text-sm text-ink/60">
            Helpers can manage guests, ushers, event details and the scanner for <b>{event.name}</b>. Only the owner can
            delete the event or change who helps.
          </p>
        </div>
        <Team
          eventId={event.id}
          eventName={event.name}
          owner={owner?.username ?? null}
          helpers={helpers}
          invites={invites}
          canManage={canManage}
        />
      </main>
    </div>
  );
}
