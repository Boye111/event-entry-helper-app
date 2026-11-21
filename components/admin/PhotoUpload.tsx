"use client";

import { useRef, useState } from "react";
import { uploadEventPhoto } from "@/lib/clientImage";
import { card, errorBox, primaryBtn } from "./styles";

export function PhotoUpload({
  eventId,
  publicId,
  initialVersion,
}: {
  eventId: number;
  publicId: string;
  initialVersion: string | null;
}) {
  const [version, setVersion] = useState(initialVersion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setVersion(await uploadEventPhoto(eventId, file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Remove the picture?")) return;
    setBusy(true);
    const res = await fetch(`/api/org/events/${eventId}/photo`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (res?.ok) setVersion(null);
    else setError("Could not remove. Try again.");
  }

  return (
    <section id="photo" className={`${card} p-5`}>
      <h2 className="font-medium">Photo or flyer</h2>
      <p className="mt-1 text-sm text-ink/60">
        A picture of the couple, or your event flyer. It appears on every guest&apos;s invite page, in the WhatsApp
        link preview and on the invite card, shown whole (never cropped).
      </p>

      <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="relative flex min-h-40 w-44 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blush ring-1 ring-gold/30">
          {version ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/photo/${publicId}?v=${version}`} alt="Event" className="block h-auto max-h-64 w-full object-contain" />
          ) : (
            <span className="p-4 text-center text-xs text-ink/50">No picture yet</span>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface/70 text-sm">Uploading…</div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={primaryBtn}>
            {version ? "Change picture" : "Upload photo or flyer"}
          </button>
          {version && (
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="rounded-lg px-4 py-2.5 text-red-600 ring-1 ring-ink/10 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <p className={`${errorBox} mt-3`}>{error}</p>}
    </section>
  );
}
