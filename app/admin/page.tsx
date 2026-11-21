import { AdminHeader } from "@/components/admin/AdminHeader";
import { SuperAdmin } from "@/components/admin/SuperAdmin";
import { pageSuper } from "@/lib/auth";
import { listEvents } from "@/lib/events";
import { listInvites } from "@/lib/invites";
import { appStats, listOrganisers } from "@/lib/organisers";

export const metadata = { title: "Super admin", robots: { index: false } };
export const dynamic = "force-dynamic";

/** App owner only (ADMIN_PASSWORD): everything across all organisers. */
export default async function SuperAdminPage() {
  await pageSuper();
  const [stats, invites, organisers, events] = await Promise.all([
    appStats(),
    listInvites(null),
    listOrganisers(),
    listEvents(null),
  ]);
  return (
    <div className="min-h-dvh bg-ivory">
      <AdminHeader viewer="super" />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6">
        <div>
          <h1 className="font-serif text-3xl">Super admin</h1>
          <p className="mt-1 text-sm text-ink/60">Everything in the app, across every organiser.</p>
        </div>
        <SuperAdmin
          stats={stats}
          invites={invites}
          organisers={organisers}
          events={events.map((e) => ({
            id: e.id,
            name: e.name,
            type: e.type,
            event_date: e.event_date,
            organiser_id: e.organiser_id,
            owner: e.owner,
            guests: e.guests,
            arrived: e.arrived_guests,
          }))}
        />
      </main>
    </div>
  );
}
