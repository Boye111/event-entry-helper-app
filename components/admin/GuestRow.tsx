"use client";

import { useState } from "react";
import { formatCheckinTime } from "@/lib/format";
import { inviteUrl } from "@/lib/site";
import type { Guest } from "@/lib/types";
import { emailLink, inviteMessage, whatsappLink } from "@/lib/whatsapp";
import { pillMuted, pillOk, smallBtn, waBtn } from "./styles";

type Props = { guest: Guest; eventTitle: string; onEdit: () => void; onChanged: () => void };

function details(g: Guest) {
  return [g.phone, g.email, g.side, g.table_no && `Table ${g.table_no}`].filter(Boolean).join(" · ");
}

function Status({ g }: { g: Guest }) {
  return g.checked_in_at ? (
    <div>
      <span className={pillOk}>Arrived {formatCheckinTime(g.checked_in_at)}</span>
      <p className="mt-1 text-xs text-ink/50">{g.checked_in_by}</p>
    </div>
  ) : (
    <span className={pillMuted}>Not arrived</span>
  );
}

function Actions({ guest: g, eventTitle, onEdit, onChanged }: Props) {
  const [copied, setCopied] = useState(false);
  const link = inviteUrl(g.code);
  const message = inviteMessage({ name: g.name, event: eventTitle, link, seats: g.seats });

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt("Copy this link:", link);
    }
  }

  async function undo() {
    if (!confirm(`Undo check-in for ${g.name}? Their QR will work again at the gate.`)) return;
    const res = await fetch(`/api/admin/guests/${g.id}/undo`, { method: "POST" }).catch(() => null);
    if (!res?.ok) alert("Could not undo. Try again.");
    onChanged();
  }

  async function remove() {
    if (!confirm(`Delete ${g.name}? Their QR code will stop working.`)) return;
    const res = await fetch(`/api/admin/guests/${g.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) alert("Could not delete. Try again.");
    onChanged();
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <a className={`${smallBtn} ${waBtn}`} href={whatsappLink(g.phone, message)} target="_blank" rel="noreferrer">
        WhatsApp
      </a>
      {g.email && (
        <a className={smallBtn} href={emailLink(g.email, `Your invitation: ${eventTitle}`, message)}>
          Email
        </a>
      )}
      <button className={smallBtn} onClick={copy}>
        {copied ? "Copied ✓" : "Copy link"}
      </button>
      <a className={smallBtn} href={`/api/qr/${g.code}?download`} download>
        QR
      </a>
      <a className={smallBtn} href={`/api/card/${g.code}?download`} download>
        Card
      </a>
      <a className={smallBtn} href={`/invite/${g.code}`} target="_blank" rel="noreferrer">
        View
      </a>
      <button className={smallBtn} onClick={onEdit}>
        Edit
      </button>
      {g.checked_in_at && (
        <button className={`${smallBtn} text-amber-700 dark:text-amber-400`} onClick={undo}>
          Undo check-in
        </button>
      )}
      <button className={`${smallBtn} text-red-600 dark:text-red-400`} onClick={remove}>
        Delete
      </button>
    </div>
  );
}

/** Table row for tablets / laptops. */
export function GuestRow(props: Props) {
  const g = props.guest;
  return (
    <tr className="border-t border-ink/5 align-top">
      <td className="px-3 py-3">
        <p className="font-medium">{g.name}</p>
        <p className="break-words text-xs text-ink/60">{details(g)}</p>
      </td>
      <td className="px-3 py-3 tabular-nums">{g.seats}</td>
      <td className="px-3 py-3">
        <Status g={g} />
      </td>
      <td className="px-3 py-3">
        <Actions {...props} />
      </td>
    </tr>
  );
}

/** Card for phones. */
export function GuestCard(props: Props) {
  const g = props.guest;
  return (
    <li className="border-t border-ink/5 p-4 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {g.name} <span className="text-sm font-normal text-ink/50">· {g.seats} seat{g.seats === 1 ? "" : "s"}</span>
          </p>
          <p className="break-words text-xs text-ink/60">{details(g)}</p>
        </div>
        <div className="shrink-0 text-right">
          <Status g={g} />
        </div>
      </div>
      <div className="mt-3">
        <Actions {...props} />
      </div>
    </li>
  );
}
