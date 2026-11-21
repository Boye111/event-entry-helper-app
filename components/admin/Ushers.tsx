"use client";

import { useCallback, useEffect, useState } from "react";
import { formatCheckinTime, plural } from "@/lib/format";
import { useSiteUrl } from "@/components/SiteUrl";
import { joinUsher } from "@/lib/site";
import type { Usher } from "@/lib/types";
import { usherMessage, whatsappLink } from "@/lib/whatsapp";
import { card, errorBox, input, pillMuted, pillOk, primaryBtn, smallBtn as btn, waBtn, warnBox } from "./styles";

export function Ushers({ eventId, eventName }: { eventId: number; eventName: string }) {
  const [ushers, setUshers] = useState<Usher[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}/ushers`, { cache: "no-store" });
      if (res.status === 401 || res.status === 403) return void (window.location.href = "/admin/login");
      if (res.ok) setUshers((await res.json()).ushers);
      setError(null);
    } catch {
      setError("Can't reach the server. Check your internet.");
    }
  }, [eventId]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="space-y-6">
      <AddUsher eventId={eventId} onAdded={load} />
      {error && <p className={warnBox}>{error}</p>}
      {!ushers && !error && <p className="text-ink/50">Loading…</p>}
      {ushers?.length === 0 && (
        <p className={`${card} p-8 text-center text-ink/50`}>
          No ushers yet. Add one above, e.g. &ldquo;Kemi – Gate A&rdquo;.
        </p>
      )}
      <ul className="space-y-3">
        {ushers?.map((u) => (
          <UsherCard key={u.id} usher={u} eventName={eventName} onChanged={load} />
        ))}
      </ul>
    </div>
  );
}

function AddUsher({ eventId, onAdded }: { eventId: number; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/ushers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not add usher.");
      setName("");
      setPhone("");
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add usher.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${card} p-5`}>
      <h2 className="mb-3 font-semibold">Add an usher</h2>
      <div className="grid gap-3 sm:grid-cols-[2fr_1.3fr_auto] sm:items-end">
        <label className="block">
          <span className="text-sm font-medium">Name &amp; gate</span>
          <input
            className={input + " mt-1"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kemi – Gate A"
            maxLength={60}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">WhatsApp number (optional)</span>
          <input
            className={input + " mt-1"}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0803 123 4567"
            inputMode="tel"
            maxLength={30}
          />
        </label>
        <button disabled={busy} className={primaryBtn}>
          {busy ? "Adding…" : "+ Add"}
        </button>
      </div>
      {error && <p className={`${errorBox} mt-3`}>{error}</p>}
    </form>
  );
}

function UsherCard({ usher: u, eventName, onChanged }: { usher: Usher; eventName: string; onChanged: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = joinUsher(useSiteUrl(), u.token);
  const wa = whatsappLink(u.phone, usherMessage({ name: u.name, event: eventName, link, pin: u.pin }));

  async function call(url: string, method: string, body?: object) {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    if (!res?.ok) alert("That didn't work. Check your internet and try again.");
    onChanged();
  }

  async function copy() {
    const text = `${link}\nPIN: ${u.pin}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt("Copy this:", text);
    }
  }

  function toggle() {
    if (u.active && !confirm(`Turn off ${u.name}? Their phone will stop scanning immediately.`)) return;
    void call(`/api/admin/ushers/${u.id}`, "PATCH", { active: !u.active });
  }
  function reset() {
    if (!confirm(`Give ${u.name} a new link and PIN? The old link stops working and they must log in again.`)) return;
    void call(`/api/admin/ushers/${u.id}/reset`, "POST");
  }
  function remove() {
    if (!confirm(`Delete ${u.name}? Guests they admitted stay checked in.`)) return;
    void call(`/api/admin/ushers/${u.id}`, "DELETE");
  }

  const status = [
    u.phone,
    u.last_login_at ? `Logged in ${formatCheckinTime(u.last_login_at)}` : "Hasn't opened the link yet",
    `Admitted ${plural(u.admitted, "guest")}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className={`${card} p-4 ${u.active ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{u.name}</p>
          <p className="text-xs text-ink/60">{status}</p>
        </div>
        <span className={u.active ? pillOk : pillMuted}>
          {u.active ? "Active" : "Turned off"}
        </span>
      </div>

      <p className="mt-3 rounded-lg bg-ink/5 px-3 py-2 text-sm">
        PIN <span className="font-mono text-base font-semibold tracking-widest">{u.pin}</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {u.active && (
          <>
            <a className={`${btn} ${waBtn}`} href={wa} target="_blank" rel="noreferrer">
              Send on WhatsApp
            </a>
            <button className={btn} onClick={copy}>
              {copied ? "Copied ✓" : "Copy link + PIN"}
            </button>
          </>
        )}
        <button className={btn} onClick={toggle}>
          {u.active ? "Turn off" : "Turn back on"}
        </button>
        <button className={`${btn} text-amber-700 dark:text-amber-400`} onClick={reset}>
          New link &amp; PIN
        </button>
        <button className={`${btn} text-red-600 dark:text-red-400`} onClick={remove}>
          Delete
        </button>
      </div>
    </li>
  );
}
