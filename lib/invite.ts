import "server-only";
import { isValidCodeShape } from "./codes";
import { getEvent, getEventPhoto } from "./events";
import { getGuestByCode } from "./guests";
import type { EventDetails, Guest } from "./types";

/** Guest + their event for the public invite page / card / preview. Null if the code is unknown. */
export async function loadInvite(code: string): Promise<{ guest: Guest; event: EventDetails } | null> {
  if (!isValidCodeShape(code)) return null;
  const guest = await getGuestByCode(code);
  if (!guest) return null;
  const event = await getEvent(guest.event_id);
  return event ? { guest, event } : null;
}

export async function eventPhotoDataUrl(event: EventDetails): Promise<string | null> {
  if (!event.photo_version) return null;
  const photo = await getEventPhoto(event.public_id);
  return photo ? `data:${photo.type};base64,${photo.data.toString("base64")}` : null;
}

// Loads a Google font as TTF for Satori (next/og). Falls back to the default font if offline.
export async function loadFont(family: string, weight: number, italic = false): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(
        `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:ital,wght@${italic ? 1 : 0},${weight}`,
        { headers: { "User-Agent": "Mozilla/4.0" } }, // old UA => TTF instead of WOFF2
      )
    ).text();
    const url = css.match(/src: url\((.+?)\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

type Font = { name: string; data: ArrayBuffer; weight: 400 | 500; style: "normal" | "italic" };

export async function serifFonts(): Promise<Font[] | undefined> {
  const [serif, italic] = await Promise.all([
    loadFont("Playfair Display", 500),
    loadFont("Playfair Display", 400, true),
  ]);
  const fonts = [
    serif && { name: "Serif", data: serif, weight: 500 as const, style: "normal" as const },
    italic && { name: "Serif", data: italic, weight: 400 as const, style: "italic" as const },
  ].filter(Boolean) as Font[];
  return fonts.length ? fonts : undefined;
}
