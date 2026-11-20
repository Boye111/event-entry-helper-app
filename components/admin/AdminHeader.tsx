"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_NAME } from "@/lib/site";

/** Top bar for organiser pages. Pass `event` on pages inside one event to show its tabs. */
export function AdminHeader({ event }: { event?: { id: number; name: string } }) {
  const path = usePathname();
  const base = event ? `/admin/events/${event.id}` : "";
  const tabs = event
    ? [
        [base, "Guests"],
        [`${base}/ushers`, "Ushers"],
        [`${base}/details`, "Details"],
        [`/scan?event=${event.id}`, "Scanner"],
      ]
    : [];

  return (
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-surface/90 backdrop-blur pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
        <Link href="/admin" className="min-w-0 mr-auto">
          <span className="block font-serif text-lg leading-tight sm:text-xl">{APP_NAME}</span>
          {event && <span className="block truncate text-xs text-ink/60">{event.name}</span>}
        </Link>
        <ThemeToggle />
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/admin/login";
          }}
          className="rounded-lg px-3 py-2 text-sm text-ink/60 hover:bg-ink/5"
        >
          Log out
        </button>
      </div>
      {event && (
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          <Link href="/admin" className="shrink-0 rounded-lg px-3 py-2 text-sm text-ink/60 hover:bg-ink/5">
            ← Events
          </Link>
          {tabs.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium ${
                path === href ? "bg-ink text-on-ink" : "hover:bg-ink/5"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

/** Warns the organiser when invite links would point at localhost (they won't open for guests). */
export function LocalUrlBanner({ siteUrl }: { siteUrl: string }) {
  return (
    <p className="rounded-lg bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
      <b>Invite links point to {siteUrl}</b>, which only works on this computer, so they won&apos;t open on
      guests&apos; phones and WhatsApp can&apos;t show a preview. Deploy the app and set{" "}
      <code>NEXT_PUBLIC_SITE_URL</code> to the live address <b>before</b> sending invites.
    </p>
  );
}
