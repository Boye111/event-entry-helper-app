"use client";

import { useEffect, useState } from "react";
import { formatCheckinTime, plural } from "@/lib/format";
import type { Guest } from "@/lib/types";

export function ManualSearch({
  onCheckIn,
  busy,
  eventQuery,
}: {
  onCheckIn: (code: string) => Promise<void>;
  busy: boolean;
  /** "&event=<id>" when the admin scans, "" for ushers */
  eventQuery: string;
}) {
  const [q, setQ] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState<Guest | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setGuests([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/guests/search?q=${encodeURIComponent(term)}${eventQuery}`, { signal: ctrl.signal });
        if (res.ok) setGuests((await res.json()).guests);
      } catch {
        /* aborted / offline */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, refreshKey, eventQuery]);

  async function doCheckIn(g: Guest) {
    setConfirm(null);
    await onCheckIn(g.code);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="absolute inset-0 overflow-y-auto bg-zinc-950 p-4">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name or phone…"
        className="w-full rounded-xl bg-white px-4 py-4 text-lg text-black outline-none"
        autoFocus
      />
      <p className="mt-2 text-sm text-white/50">For guests whose phone is dead or QR won&apos;t scan.</p>

      <ul className="mt-4 space-y-3">
        {guests.map((g) => (
          <li key={g.id} className="rounded-xl bg-zinc-900 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-semibold truncate">{g.name}</p>
                <p className="text-sm text-white/60">
                  {plural(g.seats, "seat")}
                  {g.table_no ? ` · Table ${g.table_no}` : ""}
                  {g.phone ? ` · ${g.phone}` : ""}
                </p>
                {g.checked_in_at && (
                  <p className="text-sm text-red-400">
                    Arrived {formatCheckinTime(g.checked_in_at)} · {g.checked_in_by}
                  </p>
                )}
              </div>
              {g.checked_in_at ? (
                <span className="shrink-0 rounded-lg bg-zinc-700 px-3 py-2 text-sm">Arrived</span>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => setConfirm(g)}
                  className="shrink-0 rounded-lg bg-green-600 px-4 py-3 font-bold disabled:opacity-50"
                >
                  Check in
                </button>
              )}
            </div>
          </li>
        ))}
        {!loading && q.trim().length >= 2 && guests.length === 0 && (
          <li className="text-center text-white/60 py-8">No guests found.</li>
        )}
      </ul>

      {confirm && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-black">
            <p className="text-lg">Check in</p>
            <p className="text-2xl font-bold">{confirm.name}</p>
            <p className="text-black/60 mt-1">{plural(confirm.seats, "seat")} — ask for ID if unsure.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setConfirm(null)} className="rounded-xl bg-zinc-200 py-4 font-semibold">
                Cancel
              </button>
              <button onClick={() => doCheckIn(confirm)} className="rounded-xl bg-green-600 py-4 font-bold text-white">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
