import { AdminHeader } from "@/components/admin/AdminHeader";
import { EventForm } from "@/components/admin/EventForm";

export const metadata = { title: "New event", robots: { index: false } };

export default function NewEventPage() {
  return (
    <div className="min-h-dvh bg-ivory">
      <AdminHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <h1 className="font-serif text-3xl">New event</h1>
          <p className="mt-1 text-sm text-ink/60">You can change all of this later, and add a photo after creating it.</p>
        </div>
        <EventForm />
      </main>
    </div>
  );
}
