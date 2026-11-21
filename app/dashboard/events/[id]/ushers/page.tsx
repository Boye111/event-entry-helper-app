import { AdminHeader } from "@/components/admin/AdminHeader";
import { Ushers } from "@/components/admin/Ushers";
import { pageEvent } from "@/lib/auth";

export const metadata = { title: "Ushers", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function UshersPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, event } = await pageEvent((await params).id);
  return (
    <div className="min-h-dvh bg-ivory">
      <AdminHeader event={event} viewer={session.role === "super" ? "super" : "organiser"} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <h1 className="font-serif text-3xl">Ushers</h1>
          <p className="mt-1 text-sm text-ink/60">
            Ushers for <b>{event.name}</b>. Each gets their own scanner link and PIN, and can only scan guests of this
            event. Turn an usher off or give them a new link at any time; their phone is logged out straight away.
          </p>
        </div>
        <Ushers eventId={event.id} eventName={event.name} />
      </main>
    </div>
  );
}
