"use client";

import { useState } from "react";
import { errorBox, input } from "./styles";

const WORD = "DELETE";

/**
 * Deleting removes every guest and usher of the event, so the organiser must type DELETE.
 * (A fixed word instead of the event name: phone keyboards turn ' into ’, so names never matched.)
 * `compact` = small button for the events list; the full panel is on the event's Details tab.
 */
export function DeleteEvent({
  eventId,
  eventName,
  compact = false,
  after = "/dashboard",
}: {
  eventId: number;
  eventName: string;
  compact?: boolean;
  /** Where to go once deleted */
  after?: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/org/events/${eventId}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) return void (window.location.href = after);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    setError(data?.error || "Could not delete. Check your internet and try again.");
  }

  const confirmBox = (
    <div className="mt-3 space-y-3">
      <label className="block text-sm">
        Type <b>{WORD}</b> to delete <b>{eventName}</b> with all its guests and ushers
        <input
          className={`${input} mt-1`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={remove}
          disabled={busy || typed.trim().toUpperCase() !== WORD}
          className="rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Deleting…" : "Delete forever"}
        </button>
        <button onClick={() => { setOpen(false); setTyped(""); }} className="rounded-lg px-4 py-2.5 hover:bg-ink/5">
          Cancel
        </button>
      </div>
      {error && <p className={errorBox}>{error}</p>}
    </div>
  );

  if (compact) {
    return open ? (
      confirmBox
    ) : (
      <button onClick={() => setOpen(true)} className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">
        Delete
      </button>
    );
  }

  return (
    <section className="rounded-2xl p-5 ring-1 ring-red-300 dark:ring-red-900">
      <h2 className="font-semibold text-red-700 dark:text-red-400">Delete event</h2>
      <p className="mt-1 text-sm text-ink/60">
        Removes the event with all its guests, check-ins and ushers. Every invite link and QR stops working. This
        cannot be undone. Export a CSV backup first.
      </p>
      {open ? (
        confirmBox
      ) : (
        <button onClick={() => setOpen(true)} className="mt-3 rounded-lg px-4 py-2.5 text-sm font-medium text-red-600 ring-1 ring-red-300 hover:bg-red-50 dark:ring-red-900 dark:hover:bg-red-950/40">
          Delete this event…
        </button>
      )}
    </section>
  );
}
