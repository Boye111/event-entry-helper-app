"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const field =
  "mt-1 w-full rounded-xl border border-ink/15 bg-surface px-4 py-4 text-lg text-ink outline-none focus:border-sage focus:ring-2 focus:ring-sage/30";

/** mode "admin" = organiser username + password. mode "usher" = PIN for the personal scanner link `token`. */
export function LoginForm({ mode, token }: { mode: "admin" | "usher"; token?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
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
        body: JSON.stringify(mode === "admin" ? { username, password: secret } : { token, pin: secret }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.needsSetup) return window.location.reload();
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
      {!usher && (
        <label className="block">
          <span className="text-sm font-medium">Username</span>
          <input
            className={field}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
        </label>
      )}
      <label className="block">
        <span className="text-sm font-medium">{usher ? "Your PIN" : "Password"}</span>
        <input
          className={field + (usher ? " text-center tracking-[0.5em]" : "")}
          type="password"
          inputMode={usher ? "numeric" : undefined}
          autoComplete={usher ? "one-time-code" : "current-password"}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          required
          autoFocus={usher}
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
