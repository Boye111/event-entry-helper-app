"use client";

import { useRef, useState } from "react";
import { card, primaryBtn } from "./styles";

const MAX_SIDE = 1600;

/** Shrinks big phone photos (often 5–12 MB) to a ~300 KB JPEG before upload. */
async function resize(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/jpeg", 0.85),
  );
}

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
    if (!file.type.startsWith("image/")) return setError("That file isn't an image.");
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("photo", await resize(file), "photo.jpg");
      const res = await fetch(`/api/admin/events/${eventId}/photo`, { method: "POST", body });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Upload failed.");
      setVersion(data.version);
    } catch (err) {
      setError(
        err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Upload failed — check connection.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Remove the photo?")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/events/${eventId}/photo`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (res?.ok) setVersion(null);
    else setError("Could not remove — try again.");
  }

  return (
    <div className={`${card} p-5`}>
      <h2 className="font-medium">Event photo</h2>
      <p className="mt-1 text-sm text-ink/60">
        Shown on every guest&apos;s invite page, the WhatsApp link preview and the invite card. A portrait photo works best.
      </p>

      <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="relative h-48 w-36 shrink-0 overflow-hidden rounded-t-full bg-blush ring-1 ring-gold/30">
          {version ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/photo/${publicId}?v=${version}`} alt="Event" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center text-xs text-ink/50">
              No photo yet
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface/70 text-sm">Working…</div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className={primaryBtn}
          >
            {version ? "Change photo" : "Upload photo"}
          </button>
          {version && (
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="rounded-lg px-4 py-2.5 text-red-600 ring-1 ring-ink/10 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
