import { Dashboard } from "@/components/admin/Dashboard";
import { eventTitle } from "@/lib/eventTypes";
import { pageEvent } from "@/lib/auth";
import { siteUrl, siteUrlIsLocal } from "@/lib/siteUrl";

export const metadata = { title: "Guests", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EventGuestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, event } = await pageEvent((await params).id);
  return (
    <Dashboard
      event={{ id: event.id, name: event.name, title: eventTitle(event), type: event.type, hasPhoto: !!event.photo_version }}
      localSiteUrl={siteUrlIsLocal() ? siteUrl() : null}
      viewer={session.role === "super" ? "super" : "organiser"}
    />
  );
}
