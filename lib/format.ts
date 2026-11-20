// Event times are shown in the venue's timezone regardless of where the server runs (Vercel = UTC).
export const EVENT_TZ = process.env.NEXT_PUBLIC_EVENT_TIMEZONE || "Africa/Lagos";

export function formatEventDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: EVENT_TZ,
  }).format(new Date(iso));
}

export function formatEventTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: EVENT_TZ }).format(
    new Date(iso),
  );
}

/** "3:42 PM" (today) or "12 Dec, 3:42 PM" */
export function formatCheckinTime(iso: string): string {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return new Intl.DateTimeFormat("en-GB", {
    ...(sameDay ? {} : { day: "numeric", month: "short" }),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: EVENT_TZ,
  }).format(d);
}

/** Minutes the event timezone is ahead of UTC at a given instant (Lagos = +60). */
function tzOffsetMinutes(date: Date): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: EVENT_TZ,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** ISO instant -> "YYYY-MM-DDTHH:mm" in the event timezone (for <input type="datetime-local">). */
export function toEventInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() + tzOffsetMinutes(d) * 60000).toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" typed as event-timezone wall time -> ISO instant. */
export function fromEventInput(value: string): string | null {
  if (!value) return null;
  const guess = Date.parse(value + ":00Z");
  if (Number.isNaN(guess)) return null;
  return new Date(guess - tzOffsetMinutes(new Date(guess)) * 60000).toISOString();
}

export function plural(n: number, one: string, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`;
}
