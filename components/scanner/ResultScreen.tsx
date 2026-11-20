"use client";

import { useEffect } from "react";
import { formatCheckinTime, plural } from "@/lib/format";
import type { CheckinResult } from "@/lib/types";

export type ScanOutcome = CheckinResult | { status: "error"; message: string };

const AUTO_DISMISS_MS = 3500;

export function ResultScreen({ result, onNext }: { result: ScanOutcome; onNext: () => void }) {
  // Green auto-resumes so a busy gate keeps moving; red/yellow wait for a tap so the usher reads them.
  useEffect(() => {
    if (result.status !== "admitted") return;
    const t = setTimeout(onNext, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [result, onNext]);

  let bg = "bg-red-600";
  let icon = "✕";
  let title = "";
  let body: React.ReactNode = null;

  switch (result.status) {
    case "admitted": {
      const g = result.guest;
      bg = "bg-green-600";
      icon = "✓";
      title = "ADMIT";
      body = (
        <>
          <p className="text-4xl font-bold mt-2 break-words">{g.name}</p>
          <p className="mt-6 inline-block rounded-2xl bg-white/20 px-6 py-3 text-3xl font-extrabold">
            Give {plural(g.seats, "wristband")}
          </p>
          {(g.side || g.table_no) && (
            <p className="mt-4 text-xl opacity-90">
              {[g.side && cap(g.side), g.table_no && `Table ${g.table_no}`].filter(Boolean).join(" · ")}
            </p>
          )}
        </>
      );
      break;
    }
    case "already_used":
      title = "ALREADY USED";
      body = (
        <>
          <p className="text-4xl font-bold mt-2 break-words">{result.guest.name}</p>
          <p className="mt-6 text-2xl">
            Checked in at <b>{formatCheckinTime(result.checkedInAt)}</b>
            <br />
            by <b>{result.checkedInBy}</b>
          </p>
          <p className="mt-6 text-lg opacity-90">Do not admit. Send to the organiser if there is a problem.</p>
        </>
      );
      break;
    case "invalid":
      bg = "bg-amber-500 text-black";
      icon = "?";
      title = "NOT RECOGNISED";
      body = <p className="mt-4 text-2xl">This code is not on the guest list.</p>;
      break;
    case "wrong_event":
      bg = "bg-amber-500 text-black";
      icon = "!";
      title = "WRONG EVENT";
      body = <p className="mt-4 text-2xl">This invite is for a different event. Do not admit.</p>;
      break;
    case "error":
      bg = "bg-zinc-800";
      icon = "!";
      title = "TRY AGAIN";
      body = <p className="mt-4 text-2xl">{result.message}</p>;
      break;
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center text-white ${bg}`}
      role="alert"
      aria-live="assertive"
      onClick={onNext}
    >
      <div className="text-8xl font-black leading-none">{icon}</div>
      <h2 className="mt-4 text-5xl font-black tracking-tight">{title}</h2>
      <div className="max-w-md">{body}</div>
      <button
        onClick={onNext}
        className="absolute bottom-8 left-6 right-6 rounded-2xl bg-white py-5 text-2xl font-bold text-black active:scale-[0.99]"
      >
        Scan next
      </button>
      {result.status === "admitted" && (
        <div
          className="absolute bottom-0 left-0 h-2 bg-white/70"
          style={{ animation: `shrink ${AUTO_DISMISS_MS}ms linear forwards` }}
        />
      )}
      <style>{`@keyframes shrink { from { width: 100% } to { width: 0 } }`}</style>
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
