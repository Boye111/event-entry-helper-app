import { AdminHeader } from "@/components/admin/AdminHeader";
import { redirect } from "next/navigation";
import { pageOrganiser } from "@/lib/auth";
import { EventForm } from "@/components/admin/EventForm";

export const metadata = { title: "New event", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewEventPage() {
  const session = await pageOrganiser();
  if (session.accountRole !== "organiser") redirect("/dashboard"); // helpers can't create events
  return (
    <div className="min-h-dvh bg-ivory">
      <AdminHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <h1 className="font-serif text-3xl">New event</h1>
          <p className="mt-1 text-sm text-ink/60">You can change all of this later under the event&apos;s Details tab.</p>
        </div>
        <EventForm />
      </main>
    </div>
  );
}
