"use client";

import { useState } from "react";

const field =
  "mt-1 w-full rounded-xl border border-ink/15 bg-surface px-4 py-3.5 text-lg text-ink outline-none focus:border-sage focus:ring-2 focus:ring-sage/30";

type Fields = { username: string; email: string; password: string; confirm: string };

/** Sign-up from an invite link (organiser or helper). After this they log in any time with username + password. */
export function SignupForm({ token }: { token: string }) {
  const [f, setF] = useState<Fields>({ username: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.password !== f.confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, username: f.username, email: f.email, password: f.password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not create the account.");
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account. Check your internet.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Username</span>
        <input
          className={field}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={f.username}
          onChange={set("username")}
          required
          minLength={3}
          autoFocus
        />
        <span className="mt-1 block text-xs text-ink/50">Letters, numbers, dots, dashes or underscores.</span>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input className={field} type="email" autoComplete="email" value={f.email} onChange={set("email")} required />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Password (8+ characters)</span>
        <input className={field} type="password" autoComplete="new-password" value={f.password} onChange={set("password")} required minLength={8} />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Repeat password</span>
        <input className={field} type="password" autoComplete="new-password" value={f.confirm} onChange={set("confirm")} required minLength={8} />
      </label>
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-ink py-4 text-lg font-semibold text-on-ink active:scale-[0.99] disabled:opacity-60">
        {busy ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
