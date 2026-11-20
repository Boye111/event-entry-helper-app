"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Guest, Stats } from "@/lib/types";
import { AdminHeader, LocalUrlBanner } from "./AdminHeader";
import { GuestForm } from "./GuestForm";
import { GuestImport } from "./GuestImport";
import { GuestCard, GuestRow } from "./GuestRow";
import { StatsBar } from "./StatsBar";
import { card, primaryBtn, secondaryBtn, warnBox } from "./styles";

type Filter = "all" | "arrived" | "pending";
type EventInfo = { id: number; name: string; title: string; type: string };

export function Dashboard({ event, localSiteUrl }: { event: EventInfo; localSiteUrl: string | null }) {
  const [guests, setGuests] = useState<Guest[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [panel, setPanel] = useState<"add" | "import" | null>(null);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, s] = await Promise.all([
        fetch(`/api/admin/events/${event.id}/guests`, { cache: "no-store" }),
        fetch(`/api/stats?event=${event.id}`, { cache: "no-store" }),
      ]);
      if (g.status === 401 || g.status === 403) return void (window.location.href = "/admin/login");
      if (g.ok) setGuests((await g.json()).guests);
      if (s.ok) setStats(await s.json());
      setOffline(false);
    } catch {
      setOffline(true);
    }
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
      <AdminHeader event={event} />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        {localSiteUrl && <LocalUrlBanner siteUrl={localSiteUrl} />}
        {offline && <p className={warnBox}>Can&apos;t reach the server. Showing the last loaded data.</p>}

        <div>
          <h1 className="font-serif text-2xl sm:text-3xl">{event.name}</h1>
          <p className="text-sm text-ink/60">Guests you add here are invited to this event only.</p>
        </div>

        <StatsBar stats={stats} />

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <button onClick={() => setPanel(panel === "add" ? null : "add")} className={primaryBtn}>
            + Add guest
          </button>
          <button onClick={() => setPanel(panel === "import" ? null : "import")} className={secondaryBtn}>
            Import Excel / CSV
          </button>
          <a href={`/api/admin/events/${event.id}/export`} className={`${secondaryBtn} col-span-2 sm:col-span-1`}>
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
