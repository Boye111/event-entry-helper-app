"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Stats } from "@/lib/types";
import { CameraView } from "./CameraView";
import { feedback, unlockAudio } from "./feedback";
import { ManualSearch } from "./ManualSearch";
import { ResultScreen, type ScanOutcome } from "./ResultScreen";

type Props = {
  usherName: string;
  eventName: string;
  /** Sent with every request when the admin scans; null for ushers (server uses their own event). */
  eventId: number | null;
  /** Admin only: link back to the event's guest list */
  backHref: string | null;
};

export function Scanner({ usherName, eventName, eventId, backHref }: Props) {
  const eventQuery = eventId ? `&event=${eventId}` : "";
  const [tab, setTab] = useState<"scan" | "search">("scan");
  const [result, setResult] = useState<ScanOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const lastScan = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch(eventId ? `/api/stats?event=${eventId}` : "/api/stats", { cache: "no-store" });
      if (res.status === 401) return void (window.location.href = "/scan/login");
      if (res.ok) setStats(await res.json());
    } catch {
      /* offline — keep last value */
    }
  }, [eventId]);

  useEffect(() => {
    void refreshStats();
    const t = setInterval(refreshStats, 10_000);
    return () => clearInterval(t);
  }, [refreshStats]);

  const submit = useCallback(
    async (code: string) => {
      setBusy(true);
      let outcome: ScanOutcome;
      try {
        const res = await fetch("/api/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, eventId: eventId ?? undefined }),
        });
        if (res.status === 401) {
          window.location.href = "/scan/login";
          return;
        }
        const data = await res.json().catch(() => null);
        outcome = res.ok && data?.status ? data : { status: "error", message: data?.error || "Something went wrong." };
      } catch {
        outcome = { status: "error", message: "No internet connection. Check data/Wi-Fi and scan again." };
      }
      feedback(
        outcome.status === "admitted"
          ? "ok"
          : outcome.status === "already_used"
            ? "used"
            : outcome.status === "invalid" || outcome.status === "wrong_event"
              ? "invalid"
              : "error",
      );
      setResult(outcome);
      setBusy(false);
      void refreshStats();
    },
    [refreshStats, eventId],
  );

  const onDecode = useCallback(
    (text: string) => {
      if (result || busy) return;
      // Ignore the same QR for a few seconds after dismissing, so it isn't re-scanned instantly.
      const now = Date.now();
      if (text === lastScan.current.text && now - lastScan.current.at < 4000) return;
      lastScan.current = { text, at: now };
      void submit(text);
    },
    [result, busy, submit],
  );

  const next = useCallback(() => {
    lastScan.current.at = Date.now();
    setResult(null);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/scan/login";
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white" onPointerDown={unlockAudio}>
      <header className="flex items-center justify-between gap-3 bg-zinc-900 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="truncate text-xs text-white/60">
            {eventName} · {usherName}
          </p>
          <p className="text-lg font-bold tabular-nums">
            Checked in: {stats ? `${stats.arrived_guests} / ${stats.guests}` : "…"}
          </p>
          {stats && (
            <p className="text-xs text-white/60 tabular-nums">
              {stats.arrived_seats} / {stats.seats} people
            </p>
          )}
        </div>
        {backHref ? (
          <a href={backHref} className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm">
            ← Guests
          </a>
        ) : (
          <button onClick={logout} className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm">
            Log out
          </button>
        )}
      </header>

      <div className="flex-1 relative overflow-hidden">
        {tab === "scan" ? (
          <CameraView onDecode={onDecode} paused={!!result || busy} />
        ) : (
          <ManualSearch onCheckIn={submit} busy={busy} eventQuery={eventQuery} />
        )}
        {busy && !result && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-2xl font-bold">
            Checking…
          </div>
        )}
      </div>

      <nav className="grid grid-cols-2 bg-zinc-900 pb-[env(safe-area-inset-bottom)]">
        {(["scan", "search"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-5 text-lg font-semibold ${tab === t ? "bg-white text-black" : "text-white/70"}`}
          >
            {t === "scan" ? "📷 Scan" : "🔍 Search"}
          </button>
        ))}
      </nav>

      {result && <ResultScreen result={result} onNext={next} />}
    </div>
  );
}
