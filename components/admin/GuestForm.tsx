"use client";

import { useState } from "react";
import { eventType } from "@/lib/eventTypes";
import type { Guest } from "@/lib/types";
import { input, primaryBtn } from "./styles";

/** Add a guest to `eventId`, or edit `guest`. */
export function GuestForm({
  eventId,
  eventKind,
  guest,
  onSaved,
  onCancel,
}: {
  eventId: number;
  eventKind: string;
  guest?: Guest;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const empty = { name: "", phone: "", email: "", seats: "1", side: "", table_no: "" };
  const [form, setForm] = useState(
    guest
      ? {
          name: guest.name,
          phone: guest.phone ?? "",
          email: guest.email ?? "",
          seats: String(guest.seats),
          side: guest.side ?? "",
          table_no: guest.table_no ?? "",
        }
      : empty,
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const groups = eventType(eventKind).groups;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaved(null);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(guest ? `/api/admin/guests/${guest.id}` : `/api/admin/events/${eventId}/guests`, {
      method: guest ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const data = await res?.json().catch(() => null);
      setError(data?.error ?? "Could not save. Check your connection.");
      return;
    }
    if (!guest) {
      setSaved(`${form.name} added ✓`);
      setForm(empty);
    }
    onSaved();
  }

  const field = "block text-xs text-ink/60";
  const listId = `groups-${eventId}`;

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      <label className={`${field} col-span-2`}>
        Name *
        <input className={`${input} mt-1`} value={form.name} onChange={set("name")} required maxLength={120} />
      </label>
      <label className={`${field} col-span-2 sm:col-span-1 lg:col-span-2`}>
        Phone (WhatsApp)
        <input className={`${input} mt-1`} value={form.phone} onChange={set("phone")} inputMode="tel" placeholder="0803…" maxLength={30} />
      </label>
      <label className={`${field} col-span-2 sm:col-span-1 lg:col-span-2`}>
        Email
        <input className={`${input} mt-1`} type="email" value={form.email} onChange={set("email")} placeholder="name@example.com" maxLength={200} />
      </label>
      <label className={field}>
        Seats
        <input className={`${input} mt-1`} type="number" min={1} max={20} value={form.seats} onChange={set("seats")} />
      </label>
      <label className={field}>
        Group / side
        <input className={`${input} mt-1`} value={form.side} onChange={set("side")} list={listId} maxLength={30} />
        <datalist id={listId}>
          {groups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </label>
      <label className={field}>
        Table
        <input className={`${input} mt-1`} value={form.table_no} onChange={set("table_no")} maxLength={30} />
      </label>
      <div className="col-span-2 flex flex-wrap items-center gap-2 lg:col-span-6">
        <button disabled={busy} className={primaryBtn}>
          {busy ? "Saving…" : guest ? "Save changes" : "Add guest"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2.5 hover:bg-ink/5">
            Cancel
          </button>
        )}
        {saved && <span className="text-sm font-medium text-green-700 dark:text-green-400">{saved}</span>}
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </form>
  );
}
