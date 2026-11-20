"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EVENT_TYPES, eventType } from "@/lib/eventTypes";
import { EVENT_TZ, fromEventInput, toEventInput } from "@/lib/format";
import type { EventDetails } from "@/lib/types";
import { card, errorBox, input, label, primaryBtn } from "./styles";

/** Create (no `event`) or edit an event. Creating takes you straight into the new event. */
export function EventForm({ event }: { event?: EventDetails }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: event?.name ?? "",
    type: event?.type ?? "wedding",
    hosts: event?.hosts ?? "",
    event_date: toEventInput(event?.event_date ?? null),
    venue: event?.venue ?? "",
    dress_code: event?.dress_code ?? "",
    note: event?.note ?? "",
  });
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const t = eventType(form.type);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setStatus(null);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const res = await fetch(event ? `/api/admin/events/${event.id}` : "/api/admin/events", {
      method: event ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, event_date: fromEventInput(form.event_date) }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (res?.status === 401) return void (window.location.href = "/admin/login");
    if (!res?.ok) {
      setBusy(false);
      setStatus({ ok: false, text: data?.error ?? "Could not save. Check your internet and try again." });
      return;
    }
    if (!event) {
      router.push(`/admin/events/${data.event.id}`);
      return;
    }
    setBusy(false);
    setStatus({ ok: true, text: "Saved ✓" });
    router.refresh(); // header + other pages pick up the new name
  }

  return (
    <form onSubmit={submit} className={`${card} grid gap-4 p-5 sm:grid-cols-2`}>
      <label className={label}>
        Kind of event
        <select className={`${input} mt-1`} value={form.type} onChange={set("type")}>
          {Object.entries(EVENT_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Event name *
        <input
          className={`${input} mt-1`}
          value={form.name}
          onChange={set("name")}
          placeholder={`e.g. ${t.hostsPlaceholder}${form.type === "wedding" ? "'s Wedding" : ""}`}
          required
          maxLength={120}
        />
        <span className="mt-1 block text-xs font-normal text-ink/50">For you and your ushers. Guests see the title below.</span>
      </label>
      <label className={`${label} sm:col-span-2`}>
        {t.hostsLabel} (big title on the invite)
        <input className={`${input} mt-1`} value={form.hosts} onChange={set("hosts")} placeholder={t.hostsPlaceholder} maxLength={120} />
        <span className="mt-1 block text-xs font-normal text-ink/50">
          Invite will read: &ldquo;{t.kicker} <b>{form.hosts || form.name || t.hostsPlaceholder}</b>&rdquo;
        </span>
      </label>
      <label className={label}>
        Date &amp; time
        <input className={`${input} mt-1`} type="datetime-local" value={form.event_date} onChange={set("event_date")} />
        <span className="mt-1 block text-xs font-normal text-ink/50">Venue time ({EVENT_TZ})</span>
      </label>
      <label className={label}>
        Venue
        <input className={`${input} mt-1`} value={form.venue} onChange={set("venue")} maxLength={200} />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Dress code
        <input className={`${input} mt-1`} value={form.dress_code} onChange={set("dress_code")} maxLength={120} />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Note for guests
        <textarea className={`${input} mt-1`} rows={3} value={form.note} onChange={set("note")} maxLength={1000} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button disabled={busy} className={primaryBtn}>
          {busy ? "Saving…" : event ? "Save changes" : "Create event"}
        </button>
        {status &&
          (status.ok ? (
            <span className="font-medium text-green-700 dark:text-green-400">{status.text}</span>
          ) : (
            <span className={errorBox}>{status.text}</span>
          ))}
      </div>
    </form>
  );
}
