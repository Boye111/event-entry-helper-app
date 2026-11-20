import { notFound } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { DeleteEvent } from "@/components/admin/DeleteEvent";
import { EventForm } from "@/components/admin/EventForm";
import { PhotoUpload } from "@/components/admin/PhotoUpload";
import { getEvent } from "@/lib/events";

export const metadata = { title: "Event details", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EventDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const event = await getEvent(Number((await params).id));
  if (!event) notFound();
  return (
    <div className="min-h-dvh bg-ivory">
      <AdminHeader event={event} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <h1 className="font-serif text-3xl">Event details</h1>
        <PhotoUpload eventId={event.id} publicId={event.public_id} initialVersion={event.photo_version} />
        <EventForm event={event} />
        <DeleteEvent eventId={event.id} eventName={event.name} />
      </main>
    </div>
  );
}
