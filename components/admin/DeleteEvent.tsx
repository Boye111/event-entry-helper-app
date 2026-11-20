"use client";

import { useState } from "react";
import { errorBox, input } from "./styles";

/** Deleting removes every guest and usher of the event, so the organiser must type the name. */
export function DeleteEvent({ eventId, eventName }: { eventId: number; eventName: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/events/${eventId}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) return void (window.location.href = "/admin");
    setBusy(false);
    setError("Could not delete. Check your internet and try again.");
  }

  return (
    <section className="rounded-2xl p-5 ring-1 ring-red-300 dark:ring-red-900">
      <h2 className="font-semibold text-red-700 dark:text-red-400">Delete event</h2>
      <p className="mt-1 text-sm text-ink/60">
        Removes the event with all its guests, check-ins and ushers. Every invite link and QR stops working. This
        cannot be undone. Export a CSV backup first.
      </p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-3 rounded-lg px-4 py-2.5 text-sm font-medium text-red-600 ring-1 ring-red-300 hover:bg-red-50 dark:ring-red-900 dark:hover:bg-red-950/40">
          Delete this event…
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="block text-sm">
            Type <b>{eventName}</b> to confirm
            <input className={`${input} mt-1`} value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={remove}
              disabled={busy || typed.trim() !== eventName.trim()}
              className="rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Deleting…" : "Delete forever"}
            </button>
            <button onClick={() => setOpen(false)} className="rounded-lg px-4 py-2.5 hover:bg-ink/5">
              Cancel
            </button>
          </div>
          {error && <p className={errorBox}>{error}</p>}
        </div>
      )}
    </section>
  );
}
