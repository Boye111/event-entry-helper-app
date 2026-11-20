"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** mode "admin" = organiser password. mode "usher" = PIN for the personal scanner link `token`. */
export function LoginForm({ mode, token }: { mode: "admin" | "usher"; token?: string }) {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "admin" ? { password: secret } : { token, pin: secret }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.replace(mode === "admin" ? "/admin" : "/scan");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Check your internet.");
      setBusy(false);
    }
  }

  const usher = mode === "usher";
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-sm font-medium">{usher ? "Your PIN" : "Password"}</span>
        <input
          className={
            "mt-1 w-full rounded-xl border border-ink/15 bg-surface px-4 py-4 text-lg text-ink outline-none focus:border-sage focus:ring-2 focus:ring-sage/30" +
            (usher ? " text-center tracking-[0.5em]" : "")
          }
          type="password"
          inputMode={usher ? "numeric" : undefined}
          autoComplete={usher ? "one-time-code" : "current-password"}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          required
          autoFocus
        />
      </label>
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-red-700 dark:bg-red-950/50 dark:text-red-300">{error}</p>
      )}
      <button
        disabled={busy}
        className="w-full rounded-xl bg-ink py-4 text-lg font-semibold text-on-ink active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? "Checking…" : usher ? "Start scanning" : "Log in"}
      </button>
    </form>
  );
}
