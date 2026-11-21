"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Guest, Stats } from "@/lib/types";
import { AdminHeader, LocalUrlBanner, type Viewer } from "./AdminHeader";
import { GuestForm } from "./GuestForm";
import { GuestImport } from "./GuestImport";
import { GuestCard, GuestRow } from "./GuestRow";
import { StatsBar } from "./StatsBar";
import { card, primaryBtn, secondaryBtn, warnBox } from "./styles";

type Filter = "all" | "arrived" | "pending";
type EventInfo = { id: number; name: string; title: string; type: string; hasPhoto: boolean };

export function Dashboard({
  event,
  localSiteUrl,
  viewer,
}: {
  event: EventInfo;
  localSiteUrl: string | null;
  viewer: Viewer;
}) {
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [panel, setPanel] = useState<"add" | "import" | null>(null);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const failures = useRef(0);

  // Refreshes every 10 s. A single failed refresh (phone asleep, network blip) is ignored;
  // the warning only shows after two in a row, and clears as soon as one works.
  const load = useCallback(async () => {
    let message: string | null = null;
    try {
      const [g, s] = await Promise.all([
        fetch(`/api/org/events/${event.id}/guests`, { cache: "no-store" }),
        fetch(`/api/stats?event=${event.id}`, { cache: "no-store" }),
      ]);
      if (g.status === 401 || g.status === 403) return void (window.location.href = "/login");
      if (g.ok && s.ok) {
        setGuests((await g.json()).guests);
        setStats(await s.json());
      } else {
        message = `The server had a problem (error ${g.ok ? s.status : g.status}). Retrying…`;
      }
    } catch {
      message = "Can't reach the server. Check your internet. Retrying…";
    }
    failures.current = message ? failures.current + 1 : 0;
    setProblem(message && failures.current >= 2 ? message : null);
  }, [event.id]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    return (guests ?? []).filter((g) => {
      if (filter === "arrived" && !g.checked_in_at) return false;
      if (filter === "pending" && g.checked_in_at) return false;
      if (!term) return true;
      return (
        g.name.toLowerCase().includes(term) ||
        (g.email ?? "").includes(term) ||
        (digits.length >= 3 && (g.phone ?? "").replace(/\D/g, "").includes(digits))
      );
    });
  }, [guests, q, filter]);

  const rowProps = (g: Guest) => ({
    guest: g,
    eventTitle: event.title,
    onEdit: () => setEditing(g),
    onChanged: load,
  });

  return (
    <div className="min-h-dvh bg-ivory">
      <AdminHeader event={event} viewer={viewer} />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        {localSiteUrl && <LocalUrlBanner siteUrl={localSiteUrl} />}
        {problem && (
          <p className={warnBox}>
            {problem} {guests && "The list below may be out of date."}
          </p>
        )}

        <div>
          <h1 className="font-serif text-2xl sm:text-3xl">{event.name}</h1>
          <p className="text-sm text-ink/60">Guests you add here are invited to this event only.</p>
        </div>

        {!event.hasPhoto && (
          <Link
            href={`/dashboard/events/${event.id}/details#photo`}
            className={`${card} flex items-center gap-3 p-4 hover:ring-ink/25`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blush text-lg" aria-hidden>
              🖼️
            </span>
            <span className="min-w-0 flex-1 text-sm">
              <b>Add a couple photo or flyer</b>
              <span className="block text-ink/60">It shows on every invite and in the WhatsApp preview.</span>
            </span>
            <span className="text-sm font-medium text-sage">Add →</span>
          </Link>
        )}

        <StatsBar stats={stats} />

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button onClick={() => setPanel(panel === "add" ? null : "add")} className={primaryBtn}>
            + Add guest
          </button>
          <button onClick={() => setPanel(panel === "import" ? null : "import")} className={secondaryBtn}>
            Import Excel / CSV
          </button>
          <a href={`/api/org/events/${event.id}/export`} className={`${secondaryBtn} col-span-2 sm:col-span-1`}>
            Export CSV backup
          </a>
        </div>

        {panel && (
          <section className={`${card} p-4 sm:p-5`}>
            {panel === "add" ? (
              <GuestForm eventId={event.id} eventKind={event.type} onSaved={load} />
            ) : (
              <GuestImport eventId={event.id} onImported={() => void load()} />
            )}
          </section>
        )}

        <section className={card}>
          <div className="flex flex-col gap-2 border-b border-ink/10 p-3 sm:flex-row sm:items-center">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, phone or email…"
              className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-surface px-3 py-2.5 outline-none placeholder:text-ink/35 focus:border-sage"
            />
            <div className="grid grid-cols-3 rounded-lg bg-ink/5 p-1 text-sm">
              {(
                [
                  ["all", "All"],
                  ["arrived", "Arrived"],
                  ["pending", "Not arrived"],
                ] as const
              ).map(([k, text]) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`rounded-md px-3 py-1.5 ${filter === k ? "bg-surface font-medium shadow-sm" : "text-ink/60"}`}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>

          {/* Phones: cards. Tablets and up: table. */}
          <ul className="md:hidden">
            {visible.map((g) => (
              <GuestCard key={g.id} {...rowProps(g)} />
            ))}
          </ul>
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-ink/50">
                <tr>
                  <th className="px-3 py-2 font-medium">Guest</th>
                  <th className="px-3 py-2 font-medium">Seats</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((g) => (
                  <GuestRow key={g.id} {...rowProps(g)} />
                ))}
              </tbody>
            </table>
          </div>
          {guests && visible.length === 0 && (
            <p className="p-8 text-center text-ink/50">
              {guests.length === 0 ? "No guests yet. Add one or import a file." : "No guests match."}
            </p>
          )}
          {!guests && <p className="p-8 text-center text-ink/50">Loading…</p>}
        </section>
      </main>

      {editing && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl">
            <h2 className="mb-4 font-serif text-xl">Edit {editing.name}</h2>
            <GuestForm
              eventId={event.id}
              eventKind={event.type}
              guest={editing}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                void load();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
