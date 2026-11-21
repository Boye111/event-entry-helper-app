"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const field =
  "mt-1 w-full rounded-xl border border-ink/15 bg-surface px-4 py-4 text-lg text-ink outline-none focus:border-sage focus:ring-2 focus:ring-sage/30";

/**
 * mode "organiser" = username + password (organisers and helpers) → `next` or /dashboard
 * mode "super"     = ADMIN_PASSWORD only → /admin
 * mode "usher"     = PIN for the personal scanner link `token` → /scan
 */
export function LoginForm({ mode, token, next }: { mode: "organiser" | "super" | "usher"; token?: string; next?: string }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const endpoint = { organiser: "/api/auth/login", super: "/api/auth/admin", usher: "/api/auth/usher" }[mode];
    const body =
      mode === "organiser" ? { username, password: secret } : mode === "super" ? { password: secret } : { token, pin: secret };
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.replace(mode === "organiser" ? next || "/dashboard" : mode === "super" ? "/admin" : "/scan");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Check your internet.");
      setBusy(false);
    }
  }

  const usher = mode === "usher";
  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "organiser" && (
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
          autoFocus={mode !== "organiser"}
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
