"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSiteUrl } from "@/components/SiteUrl";
import { eventType } from "@/lib/eventTypes";
import { formatCheckinTime, formatEventDate, plural } from "@/lib/format";
import type { Invite } from "@/lib/invites";
import type { AppStats, OrganiserSummary } from "@/lib/organisers";
import { APP_NAME, joinSignup } from "@/lib/site";
import { organiserInviteMessage, tempPasswordMessage, whatsappLink } from "@/lib/whatsapp";
import { card, errorBox, input, pillMuted, pillOk, primaryBtn, smallBtn, waBtn } from "./styles";

type EventLite = {
  id: number;
  name: string;
  type: string;
  event_date: string | null;
  organiser_id: number | null;
  owner: string | null;
  guests: number;
  arrived: number;
};

type Props = {
  stats: AppStats;
  invites: Invite[];
  organisers: OrganiserSummary[];
  events: EventLite[];
};

/** Calls an API and refreshes the server data. Returns the JSON body, or throws with a readable message. */
function useAction() {
  const router = useRouter();
  return async (url: string, method: string, body?: object) => {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok) throw new Error(data?.error || "Something went wrong. Check your internet.");
    router.refresh();
    return data;
  };
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    prompt("Copy this:", text);
    return false;
  }
}

const sectionTitle = "font-serif text-2xl";

export function SuperAdmin({ stats, invites, organisers, events }: Props) {
  return (
    <>
      <Overview stats={stats} />
      <Invites invites={invites} />
      <Organisers organisers={organisers} />
      <AllEvents events={events} organisers={organisers} />
    </>
  );
}

// ------------------------------------------------------------------ overview

function Overview({ stats: s }: { stats: AppStats }) {
  const tiles: [string, string | number, string?][] = [
    ["Organisers", s.organisers, `${s.helpers} helpers · ${s.active_accounts} accounts active`],
    ["Events", s.events, `${s.upcoming_events} upcoming${s.unowned_events ? ` · ${s.unowned_events} without owner` : ""}`],
    ["Guests invited", s.guests, `${s.seats} people`],
    ["Checked in", s.arrived, `${s.arrived_7d} in the last 7 days`],
    ["Ushers", s.ushers],
    ["Open invite links", s.open_invites],
  ];
  return (
    <section>
      <h2 className={sectionTitle}>Overview</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className={`${card} p-4`}>
            <p className="text-xs text-ink/60">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
            {sub && <p className="text-xs text-ink/50">{sub}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ invites

const inviteStatus = {
  open: ["Open", pillOk],
  used: ["Used", pillMuted],
  expired: ["Expired", pillMuted],
  revoked: ["Cancelled", pillMuted],
} as const;

function Invites({ invites }: { invites: Invite[] }) {
  const act = useAction();
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await act("/api/admin/invites", "POST", { label, days });
      setLabel("");
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  const open = invites.filter((i) => i.status === "open");
  const closed = invites.filter((i) => i.status !== "open");

  return (
    <section>
      <h2 className={sectionTitle}>Invite links</h2>
      <p className="mt-1 text-sm text-ink/60">
        New organisers can only sign up with one of these. Each link creates one account, then stops working.
        (Organisers invite their own helpers from an event&apos;s Team tab.)
      </p>
      <form onSubmit={create} className={`${card} mt-3 flex flex-wrap items-end gap-3 p-4`}>
        <label className="min-w-48 flex-1 text-sm font-medium">
          Who is it for?
          <input className={`${input} mt-1`} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Kemi (wedding planner)" required maxLength={80} />
        </label>
        <label className="text-sm font-medium">
          Valid for
          <select className={`${input} mt-1`} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={1}>1 day</option>
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
          </select>
        </label>
        <button disabled={busy} className={primaryBtn}>
          {busy ? "Creating…" : "+ Create link"}
        </button>
        {error && <p className={`${errorBox} w-full`}>{error}</p>}
      </form>

      <ul className="mt-3 space-y-2">
        {open.length === 0 && <li className="text-sm text-ink/50">No open invite links.</li>}
        {open.map((i) => (
          <InviteRow key={i.id} invite={i} />
        ))}
      </ul>
      {closed.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowClosed(!showClosed)} className="text-sm text-ink/60 underline">
            {showClosed ? "Hide" : "Show"} used, expired and cancelled ({closed.length})
          </button>
          {showClosed && (
            <ul className="mt-2 space-y-2">
              {closed.map((i) => (
                <InviteRow key={i.id} invite={i} />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function InviteRow({ invite: i }: { invite: Invite }) {
  const act = useAction();
  const base = useSiteUrl();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = joinSignup(base, i.token);
  const daysLeft = Math.max(1, Math.ceil((new Date(i.expires_at).getTime() - Date.now()) / 86_400_000));
  const [statusLabel, pill] = inviteStatus[i.status];

  return (
    <li className={`${card} flex flex-wrap items-center gap-x-3 gap-y-2 p-3`}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          {i.label} <span className={pill}>{statusLabel}</span>
        </p>
        <p className="text-xs text-ink/50">
          {i.status === "used"
            ? `Used by ${i.used_by_username ?? "a deleted account"} ${formatCheckinTime(i.used_at!)}`
            : i.status === "open"
              ? `Expires ${formatCheckinTime(i.expires_at)}`
              : `Made ${formatCheckinTime(i.created_at)}`}
        </p>
      </div>
      {i.status === "open" && (
        <div className="flex flex-wrap gap-2">
          <a
            className={`${smallBtn} ${waBtn}`}
            href={whatsappLink(null, organiserInviteMessage({ appName: APP_NAME, link, days: daysLeft }))}
            target="_blank"
            rel="noreferrer"
          >
            WhatsApp
          </a>
          <button
            className={smallBtn}
            onClick={async () => {
              if (await copy(link)) {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }
            }}
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
          <button
            className={`${smallBtn} text-red-600`}
            onClick={async () => {
              if (!confirm(`Cancel the invite for ${i.label}? The link stops working.`)) return;
              await act(`/api/admin/invites/${i.id}`, "DELETE").catch((e) => setError(e.message));
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {error && <p className={`${errorBox} w-full`}>{error}</p>}
    </li>
  );
}

// ------------------------------------------------------------------ organisers

function Organisers({ organisers }: { organisers: OrganiserSummary[] }) {
  return (
    <section>
      <h2 className={sectionTitle}>Organisers &amp; helpers</h2>
      <p className="mt-1 text-sm text-ink/60">
        Helpers only work on events they were added to. <b>Make organiser</b> lets one create their own events.
      </p>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {organisers.length === 0 && <li className="text-sm text-ink/50">No accounts yet. Create an invite link above.</li>}
        {organisers.map((o) => (
          <OrganiserCard key={o.id} o={o} />
        ))}
      </ul>
    </section>
  );
}

function OrganiserCard({ o }: { o: OrganiserSummary }) {
  const act = useAction();
  const base = useSiteUrl();
  const [error, setError] = useState<string | null>(null);
  const [temp, setTemp] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");

  const run = (fn: () => Promise<unknown>) => async () => {
    setError(null);
    await fn().catch((e) => setError(e.message));
  };

  const resetPassword = run(async () => {
    if (!confirm(`Give ${o.username} a temporary password? They are logged out everywhere until they use it.`)) return;
    const data = await act(`/api/admin/organisers/${o.id}/password`, "POST");
    setTemp(data.password);
  });

  return (
    <li className={`${card} p-4 ${o.active ? "" : "opacity-70"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto font-semibold">{o.username}</p>
        <span className={o.role === "helper" ? pillMuted : "rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold"}>
          {o.role === "helper" ? "Helper" : "Organiser"}
        </span>
        {!o.active && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">Turned off</span>}
      </div>
      <p className="text-sm text-ink/60">{o.email ?? "No email"}</p>
      <p className="mt-2 text-sm tabular-nums">
        {plural(o.events, "event")} owned{o.helping ? ` · helping on ${o.helping}` : ""} · {plural(o.guests, "guest")} ·{" "}
        {o.arrived} checked in
      </p>
      <p className="mt-1 text-xs text-ink/50">
        Joined {formatCheckinTime(o.created_at)}
        {o.invite_label && ` via "${o.invite_label}"`} ·{" "}
        {o.last_login_at ? `last login ${formatCheckinTime(o.last_login_at)}` : "never logged in"}
      </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className={smallBtn}
            onClick={run(async () => {
              if (o.active && !confirm(`Turn off ${o.username}? They are logged out now and can't log in until you turn them back on.`)) return;
              await act(`/api/admin/organisers/${o.id}`, "PATCH", { active: !o.active });
            })}
          >
            {o.active ? "Turn off" : "Turn on"}
          </button>
          <button
            className={smallBtn}
            onClick={run(() =>
              act(`/api/admin/organisers/${o.id}`, "PATCH", { role: o.role === "helper" ? "organiser" : "helper" }),
            )}
          >
            {o.role === "helper" ? "Make organiser" : "Make helper"}
          </button>
          <button className={smallBtn} onClick={resetPassword}>
            Reset password
          </button>
          <button className={`${smallBtn} text-red-600`} onClick={() => setConfirmDelete(!confirmDelete)}>
            Delete…
          </button>
        </div>

      {temp && (
        <div className="mt-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          <p>
            Temporary password for <b>{o.username}</b>: <code className="text-base font-bold">{temp}</code>
          </p>
          <p className="mt-1 text-xs">Shown only once. Send it now; they should change it under Account.</p>
          <div className="mt-2 flex gap-2">
            <a
              className={`${smallBtn} ${waBtn}`}
              target="_blank"
              rel="noreferrer"
              href={whatsappLink(null, tempPasswordMessage({ appName: APP_NAME, username: o.username, password: temp, loginUrl: `${base}/login` }))}
            >
              WhatsApp
            </a>
            <button className={smallBtn} onClick={() => copy(temp)}>
              Copy
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="mt-3 space-y-2 rounded-lg p-3 ring-1 ring-red-300 dark:ring-red-900">
          <p className="text-sm">
            Deletes <b>{o.username}</b> and the {plural(o.events, "event")} they own, with {plural(o.guests, "guest")} and ushers.
            Their invite links and QR codes stop working. Type <b>DELETE</b> to confirm.
          </p>
          <input className={input} value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" />
          <button
            disabled={typed.trim().toUpperCase() !== "DELETE"}
            className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
            onClick={run(() => act(`/api/admin/organisers/${o.id}`, "DELETE"))}
          >
            Delete forever
          </button>
        </div>
      )}
      {error && <p className={`${errorBox} mt-3`}>{error}</p>}
    </li>
  );
}

// ------------------------------------------------------------------ all events

function AllEvents({ events, organisers }: { events: EventLite[]; organisers: OrganiserSummary[] }) {
  const act = useAction();
  const [q, setQ] = useState("");
  const [cleanup, setCleanup] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const term = q.trim().toLowerCase();
  const shown = term
    ? events.filter((e) => e.name.toLowerCase().includes(term) || (e.owner ?? "").includes(term))
    : events;
  const unowned = events.filter((e) => e.organiser_id === null);

  return (
    <section>
      <h2 className={sectionTitle}>All events</h2>
      <p className="mt-1 text-sm text-ink/60">
        Open any event to check on it or help. <b>Move</b> hands an event to another organiser; <b>Delete</b> removes it
        with all its guests and ushers.
      </p>

      {unowned.length > 0 && (
        <div className="mt-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          <p>
            <b>{plural(unowned.length, "event")} with no owner</b> (old data from before accounts, or test events). Move
            the ones you want to keep, then delete the rest.
          </p>
          {!cleanup ? (
            <button className={`${smallBtn} mt-2 bg-surface text-red-600`} onClick={() => setCleanup(true)}>
              Delete all events with no owner…
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <p>
                Deletes {unowned.map((e) => `"${e.name}"`).join(", ")} with{" "}
                {plural(unowned.reduce((n, e) => n + e.guests, 0), "guest")}. Type <b>DELETE</b> to confirm.
              </p>
              <input className={input} value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" />
              <div className="flex gap-2">
                <button
                  className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
                  disabled={typed.trim().toUpperCase() !== "DELETE"}
                  onClick={async () => {
                    setError(null);
                    await act("/api/admin/events/unowned", "POST", { confirm: "DELETE" })
                      .then(() => {
                        setCleanup(false);
                        setTyped("");
                      })
                      .catch((err) => setError(err.message));
                  }}
                >
                  Delete forever
                </button>
                <button className={smallBtn} onClick={() => setCleanup(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {error && <p className={`${errorBox} mt-2`}>{error}</p>}
        </div>
      )}

      <input className={`${input} mt-3 max-w-sm`} placeholder="Search event or organiser" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="mt-3 space-y-2">
        {shown.length === 0 && <li className="text-sm text-ink/50">No events.</li>}
        {shown.map((e) => (
          <EventRow key={e.id} e={e} organisers={organisers} />
        ))}
      </ul>
    </section>
  );
}

function EventRow({ e, organisers }: { e: EventLite; organisers: OrganiserSummary[] }) {
  const act = useAction();
  const [to, setTo] = useState<number>(e.organiser_id ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");
  const changed = to !== 0 && to !== e.organiser_id;

  return (
    <li className={`${card} flex flex-wrap items-center gap-x-4 gap-y-2 p-3`}>
      <div className="min-w-0 flex-1">
        <Link href={`/dashboard/events/${e.id}`} className="font-medium hover:underline">
          {e.name}
        </Link>
        <p className="text-xs text-ink/50">
          {e.owner ?? "No owner"} · {eventType(e.type).label} · {formatEventDate(e.event_date) ?? "No date"} ·{" "}
          {plural(e.guests, "guest")} · {e.arrived} checked in
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${input} w-auto py-1.5 text-sm`} value={to} onChange={(ev) => setTo(Number(ev.target.value))} aria-label="Owner">
          {e.organiser_id === null && <option value={0}>No owner</option>}
          {organisers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.username}
            </option>
          ))}
        </select>
        {changed && (
          <button
            className={smallBtn}
            onClick={async () => {
              const name = organisers.find((o) => o.id === to)?.username;
              if (!confirm(`Move "${e.name}" with all its guests and ushers to ${name}?`)) return setTo(e.organiser_id ?? 0);
              setError(null);
              await act(`/api/admin/events/${e.id}`, "PATCH", { organiserId: to }).catch((err) => setError(err.message));
            }}
          >
            Move
          </button>
        )}
        <button className={`${smallBtn} text-red-600`} onClick={() => setConfirmDelete(!confirmDelete)}>
          Delete…
        </button>
      </div>
      {confirmDelete && (
        <div className="w-full space-y-2 rounded-lg p-3 text-sm ring-1 ring-red-300 dark:ring-red-900">
          <p>
            Deletes <b>{e.name}</b> with {plural(e.guests, "guest")}, its ushers and helpers. Invite links and QR codes stop
            working. Type <b>DELETE</b> to confirm.
          </p>
          <input className={input} value={typed} onChange={(ev) => setTyped(ev.target.value)} autoCapitalize="characters" autoComplete="off" />
          <button
            className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
            disabled={typed.trim().toUpperCase() !== "DELETE"}
            onClick={async () => {
              setError(null);
              await act(`/api/org/events/${e.id}`, "DELETE").catch((err) => setError(err.message));
            }}
          >
            Delete forever
          </button>
        </div>
      )}
      {error && <p className={`${errorBox} w-full`}>{error}</p>}
    </li>
  );
}
