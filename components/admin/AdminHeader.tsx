"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSiteUrl } from "@/components/SiteUrl";
import { APP_NAME } from "@/lib/site";

/** Who is looking: an account (organiser or helper) or the super admin. Changes the links in the bar. */
export type Viewer = "organiser" | "super";

/**
 * Top bar for organiser, helper and super admin pages. Pass `event` on pages inside one event to show its tabs.
 * The super admin opens event pages to help; for them "home" is /admin and there is no Account page.
 */
export function AdminHeader({ event, viewer = "organiser" }: { event?: { id: number; name: string }; viewer?: Viewer }) {
  const path = usePathname();
  const home = viewer === "super" ? "/admin" : "/dashboard";
  const base = event ? `/dashboard/events/${event.id}` : "";
  const tabs = event
    ? [
        [base, "Guests"],
        [`${base}/ushers`, "Ushers"],
        [`${base}/team`, "Team"],
        [`${base}/details`, "Details"],
        [`/scan?event=${event.id}`, "Scanner"],
      ]
    : [];

  return (
    <header className="sticky top-0 z-20 border-b border-ink/10 bg-surface/90 backdrop-blur pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5">
        <Link href={home} className="min-w-0 mr-auto">
          <span className="block font-serif text-lg leading-tight sm:text-xl">
            {APP_NAME}
            {viewer === "super" && <span className="ml-2 align-middle text-xs font-sans font-semibold text-gold">SUPER ADMIN</span>}
          </span>
          {event && <span className="block truncate text-xs text-ink/60">{event.name}</span>}
        </Link>
        <ThemeToggle />
        {viewer === "organiser" && (
          <Link href="/dashboard/account" className="rounded-lg px-3 py-2 text-sm text-ink/60 hover:bg-ink/5">
            Account
          </Link>
        )}
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = viewer === "super" ? "/admin/login" : "/login";
          }}
          className="rounded-lg px-3 py-2 text-sm text-ink/60 hover:bg-ink/5"
        >
          Log out
        </button>
      </div>
      {event && (
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          <Link href={home} className="shrink-0 rounded-lg px-3 py-2 text-sm text-ink/60 hover:bg-ink/5">
            {viewer === "super" ? "← Super admin" : "← Events"}
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
      <WrongSiteUrlBanner />
    </header>
  );
}

/**
 * Shown when this page is open on a different address from the one inside invite links and QR codes
 * (e.g. a Vercel preview address, or a SITE_URL typed wrong), so the organiser notices before sending invites.
 */
function WrongSiteUrlBanner() {
  const configured = useSiteUrl();
  const [here, setHere] = useState<string | null>(null);
  useEffect(() => setHere(window.location.origin), []);
  if (!here || /\/\/(localhost|127\.0\.0\.1)/.test(here) || here === configured) return null;
  return (
    <p className="bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
      <b>Heads up: invite links and QR codes use {configured}</b>, but you are on <b>{here}</b>. That is fine if{" "}
      {configured} is your main address. If it isn&apos;t, set <code>SITE_URL</code> to <b>{here}</b> in Vercel and
      redeploy.
    </p>
  );
}

/** Warns the organiser when invite links would point at localhost (they won't open for guests). */
export function LocalUrlBanner({ siteUrl }: { siteUrl: string }) {
  return (
    <p className="rounded-lg bg-amber-100 px-4 py-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
      <b>Invite links point to {siteUrl}</b>, which only works on this computer, so they won&apos;t open on
      guests&apos; phones. That&apos;s expected while testing locally. On Vercel the live address is picked up
      automatically.
    </p>
  );
}
