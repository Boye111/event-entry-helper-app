import { notFound } from "next/navigation";
import { Dashboard } from "@/components/admin/Dashboard";
import { eventTitle } from "@/lib/eventTypes";
import { getEvent } from "@/lib/events";
import { siteUrl, siteUrlIsLocal } from "@/lib/siteUrl";

export const metadata = { title: "Guests", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EventGuestsPage({ params }: { params: Promise<{ id: string }> }) {
  const event = await getEvent(Number((await params).id));
  if (!event) notFound();
  return (
    <Dashboard
      event={{ id: event.id, name: event.name, title: eventTitle(event), type: event.type, hasPhoto: !!event.photo_version }}
      localSiteUrl={siteUrlIsLocal() ? siteUrl() : null}
    />
  );
}
