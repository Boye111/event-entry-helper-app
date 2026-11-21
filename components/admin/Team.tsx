"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSiteUrl } from "@/components/SiteUrl";
import { formatCheckinTime } from "@/lib/format";
import type { Invite } from "@/lib/invites";
import type { Helper } from "@/lib/organisers";
import { APP_NAME, joinSignup } from "@/lib/site";
import { whatsappLink } from "@/lib/whatsapp";
import { card, errorBox, input, pillMuted, primaryBtn, smallBtn, waBtn } from "./styles";

type Props = {
  eventId: number;
  eventName: string;
  owner: string | null;
  helpers: Helper[];
  invites: Invite[];
  canManage: boolean;
};

function helperMessage(event: string, link: string) {
  return (
    `Hi! I'd like you to help me run ${event} on ${APP_NAME} (guest list, ushers and gate check-in).\n\n` +
    `Open this link to join (it works once):\n${link}\n\n` +
    `If you're new, you'll choose a username and password there.`
  );
}

export function Team({ eventId, eventName, owner, helpers, invites, canManage }: Props) {
  const router = useRouter();
  const base = useSiteUrl();
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  async function call(url: string, method: string, body?: object) {
    setError(null);
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) {
      setError(data?.error || "Something went wrong. Check your internet.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (await call(`/api/org/events/${eventId}/team`, "POST", { label, days: 7 })) setLabel("");
    setBusy(false);
  }

  const open = invites.filter((i) => i.status === "open");

  return (
    <div className="space-y-6">
      <section className={`${card} divide-y divide-ink/5`}>
        <div className="flex items-center gap-2 p-4">
          <p className="mr-auto font-medium">{owner ?? "No owner yet"}</p>
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">Owner</span>
        </div>
        {helpers.map((h) => (
          <div key={h.id} className="flex flex-wrap items-center gap-2 p-4">
            <div className="mr-auto min-w-0">
              <p className="font-medium">{h.username}</p>
              <p className="text-xs text-ink/50">
                {h.email ?? "No email"} · added {formatCheckinTime(h.added_at)}
              </p>
            </div>
            <span className={pillMuted}>Helper</span>
            {canManage && (
              <button
                className={`${smallBtn} text-red-600`}
                onClick={() => {
                  if (confirm(`Remove ${h.username} from ${eventName}? Their account stays; they just lose this event.`))
                    void call(`/api/org/events/${eventId}/team/${h.id}`, "DELETE");
                }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
        {helpers.length === 0 && <p className="p-4 text-sm text-ink/50">No helpers yet.</p>}
      </section>

      {canManage && (
        <section className="space-y-3">
          <h2 className="font-serif text-2xl">Invite a helper</h2>
          <form onSubmit={invite} className={`${card} flex flex-wrap items-end gap-3 p-4`}>
            <label className="min-w-48 flex-1 text-sm font-medium">
              Who is it for?
              <input
                className={`${input} mt-1`}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Tolu (sister)"
                required
                maxLength={80}
              />
            </label>
            <button disabled={busy} className={primaryBtn}>
              {busy ? "Creating…" : "+ Create invite link"}
            </button>
            <p className="w-full text-xs text-ink/50">
              One-time link, valid for 7 days. Send it on WhatsApp. If they already have an account they just log in and
              join.
            </p>
          </form>
          <ul className="space-y-2">
            {open.map((i) => {
              const link = joinSignup(base, i.token);
              return (
                <li key={i.id} className={`${card} flex flex-wrap items-center gap-2 p-3`}>
                  <div className="mr-auto min-w-0">
                    <p className="font-medium">{i.label}</p>
                    <p className="text-xs text-ink/50">Not used yet · expires {formatCheckinTime(i.expires_at)}</p>
                  </div>
                  <a className={`${smallBtn} ${waBtn}`} href={whatsappLink(null, helperMessage(eventName, link))} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                  <button
                    className={smallBtn}
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(link);
                        setCopied(i.id);
                        setTimeout(() => setCopied(null), 1500);
                      } catch {
                        prompt("Copy this link:", link);
                      }
                    }}
                  >
                    {copied === i.id ? "Copied ✓" : "Copy link"}
                  </button>
                  <button
                    className={`${smallBtn} text-red-600`}
                    onClick={() => {
                      if (confirm(`Cancel the invite for ${i.label}?`)) void call(`/api/org/events/${eventId}/invites/${i.id}`, "DELETE");
                    }}
                  >
                    Cancel
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {error && <p className={errorBox}>{error}</p>}
    </div>
  );
}
