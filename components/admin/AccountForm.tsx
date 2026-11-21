"use client";

import { useState } from "react";
import { card, errorBox, input, label, primaryBtn } from "./styles";

type Fields = { current: string; next: string; confirm: string; email: string };

/** Change password and/or email. The current password is always required. */
export function AccountForm({ email: initialEmail }: { email: string | null }) {
  const [f, setF] = useState<Fields>({ current: "", next: "", confirm: "", email: initialEmail ?? "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.next && f.next !== f.confirm) return setMsg({ ok: false, text: "The two new passwords don't match." });
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: f.current, newPassword: f.next || undefined, email: f.email }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setMsg({ ok: false, text: data?.error || "Could not save. Check your internet." });
    setF({ ...f, current: "", next: "", confirm: "" });
    setMsg({ ok: true, text: f.next ? "Saved. Use your new password next time you log in." : "Saved." });
  }

  return (
    <form onSubmit={submit} className={`${card} space-y-4 p-5`}>
      <label className={label}>
        Email (for password reset later)
        <input className={`${input} mt-1`} type="email" autoComplete="email" value={f.email} onChange={set("email")} />
      </label>
      <label className={label}>
        New password <span className="font-normal text-ink/50">(leave empty to keep it)</span>
        <input className={`${input} mt-1`} type="password" autoComplete="new-password" minLength={8} value={f.next} onChange={set("next")} />
      </label>
      {f.next && (
        <label className={label}>
          Repeat new password
          <input className={`${input} mt-1`} type="password" autoComplete="new-password" value={f.confirm} onChange={set("confirm")} required />
        </label>
      )}
      <label className={label}>
        Current password
        <input className={`${input} mt-1`} type="password" autoComplete="current-password" value={f.current} onChange={set("current")} required />
      </label>
      {msg && (
        <p className={msg.ok ? "rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300" : errorBox}>
          {msg.text}
        </p>
      )}
      <button disabled={busy} className={primaryBtn}>
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
