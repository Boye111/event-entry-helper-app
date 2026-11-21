"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Guest, Stats } from "@/lib/types";
import { AdminHeader, LocalUrlBanner, type Viewer } from "./AdminHeader";
import { GuestForm } from "./GuestForm";
import { GuestImport } from "./GuestImport";
import { GuestCard, GuestRow } from "./GuestRow";
import { StatsBar } from "./StatsBar";
import { card, errorBox, input, primaryBtn, secondaryBtn, smallBtn, warnBox } from "./styles";

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
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [panel, setPanel] = useState<"add" | "import" | null>(null);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const failures = useRef(0);
  // Bulk delete
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleteAll, setDeleteAll] = useState(false);
  const [typed, setTyped] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Refreshes every 10 s with ONE request; the numbers at the top are counted from the same list.
  // A single failed refresh (phone asleep, network blip) is ignored; the warning only shows after
  // two in a row, and clears as soon as one works.
  const load = useCallback(async () => {
    let message: string | null = null;
    let res: Response | null = null;
    try {
      res = await fetch(`/api/org/events/${event.id}/guests`, { cache: "no-store" });
    } catch {
      message = navigator.onLine
        ? "Couldn't load the guest list (the connection dropped, or a browser ad blocker stopped it). Retrying…"
        : "You're offline. Check your internet. Retrying…";
    }
    if (res) {
      if (res.status === 401) return void (window.location.href = viewer === "super" ? "/admin/login" : "/login");
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data?.guests)) setGuests(data.guests);
      else message = `${data?.error ?? "The server had a problem"} (error ${res.status}). Retrying…`;
    }
    failures.current = message ? failures.current + 1 : 0;
    setProblem(message && failures.current >= 2 ? message : null);
  }, [event.id, viewer]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  const stats = useMemo<Stats | null>(
    () =>
      guests && {
        guests: guests.length,
        seats: guests.reduce((n, g) => n + g.seats, 0),
        arrived_guests: guests.filter((g) => g.checked_in_at).length,
        arrived_seats: guests.reduce((n, g) => n + (g.checked_in_at ? g.seats : 0), 0),
      },
    [guests],
  );

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
    selectable: selecting,
    selected: selected.has(g.id),
    onToggle: () =>
      setSelected((s) => {
        const n = new Set(s);
        if (n.has(g.id)) n.delete(g.id);
        else n.add(g.id);
        return n;
      }),
  });

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
    setBulkError(null);
  }

  /** ids = selected guests; null = every guest of this event. */
  async function bulkDelete(ids: number[] | null) {
    setBulkBusy(true);
    setBulkError(null);
    const res = await fetch(`/api/org/events/${event.id}/guests/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids } : { all: true }),
    }).catch(() => null);
    setBulkBusy(false);
    if (!res?.ok) return setBulkError("Could not delete. Check your internet and try again.");
    stopSelecting();
    setDeleteAll(false);
    setTyped("");
    void load();
  }

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

          {guests && guests.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 px-3 py-2 text-sm">
              {!selecting ? (
                <>
                  <button className={smallBtn} onClick={() => setSelecting(true)}>
                    Select guests to delete
                  </button>
                  <button className={`${smallBtn} text-red-600 dark:text-red-400`} onClick={() => setDeleteAll(!deleteAll)}>
                    Delete all guests…
                  </button>
                </>
              ) : (
                <>
                  <span className="font-medium">{selected.size} selected</span>
                  <button className={smallBtn} onClick={() => setSelected(new Set(visible.map((g) => g.id)))}>
                    Select all {visible.length} shown
                  </button>
                  <button className={smallBtn} onClick={() => setSelected(new Set())}>
                    Clear
                  </button>
                  <button
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    disabled={!selected.size || bulkBusy}
                    onClick={() => {
                      if (confirm(`Delete ${selected.size} guest(s)? Their QR codes stop working. This cannot be undone.`))
                        void bulkDelete([...selected]);
                    }}
                  >
                    {bulkBusy ? "Deleting…" : `Delete ${selected.size}`}
                  </button>
                  <button className={smallBtn} onClick={stopSelecting}>
                    Done
                  </button>
                </>
              )}
              {deleteAll && !selecting && (
                <div className="w-full space-y-2 rounded-lg p-3 ring-1 ring-red-300 dark:ring-red-900">
                  <p>
                    Deletes all <b>{guests.length}</b> guests of this event; every invite link and QR stops working. Export
                    a CSV backup first. Type <b>DELETE</b> to confirm.
                  </p>
                  <input
                    className={input}
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    autoCapitalize="characters"
                    autoComplete="off"
                  />
                  <button
                    className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
                    disabled={typed.trim().toUpperCase() !== "DELETE" || bulkBusy}
                    onClick={() => void bulkDelete(null)}
                  >
                    {bulkBusy ? "Deleting…" : "Delete all guests"}
                  </button>
                </div>
              )}
              {bulkError && <p className={`${errorBox} w-full`}>{bulkError}</p>}
            </div>
          )}

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
                  {selecting && <th className="w-8 pl-3" />}
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
