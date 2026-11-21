"use client";

import { useState } from "react";

/** Logged-in account accepts a helper invite. */
export function JoinEventButton({ token, username }: { token: string; username: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (res?.ok) return void (window.location.href = `/dashboard/events/${data.eventId}`);
    setBusy(false);
    setError(data?.error || "Could not join. Check your internet.");
  }

  return (
    <div className="space-y-3">
      <button
        onClick={join}
        disabled={busy}
        className="w-full rounded-xl bg-ink py-4 text-lg font-semibold text-on-ink active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? "Joining…" : `Join as ${username}`}
      </button>
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</p>}
    </div>
  );
}
