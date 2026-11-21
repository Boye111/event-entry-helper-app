// Browser-only helpers for the event photo / flyer upload.

const MAX_SIDE = 1600;

/** Shrinks big phone photos (often 5-12 MB) to a ~300 KB JPEG before upload. Keeps the shape. */
export async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // flyers with transparent parts get a white background, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/jpeg", 0.85),
  );
}

/** Uploads a photo/flyer for an event. Returns the new version, or throws a readable error. */
export async function uploadEventPhoto(eventId: number, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't a picture. Use a JPG or PNG.");
  let blob: Blob;
  try {
    blob = await resizeImage(file);
  } catch {
    throw new Error("Couldn't read that picture. Try a JPG or PNG (iPhone HEIC photos: take a screenshot of it).");
  }
  const body = new FormData();
  body.append("photo", blob, "photo.jpg");
  const res = await fetch(`/api/org/events/${eventId}/photo`, { method: "POST", body }).catch(() => null);
  const data = await res?.json().catch(() => null);
  if (!res) throw new Error("Upload failed. Check your internet and try again.");
  if (!res.ok) throw new Error(data?.error ?? "Upload failed.");
  return data.version;
}
