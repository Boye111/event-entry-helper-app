/** Product name shown in the UI and page titles. Change it here to rename the app everywhere. */
export const APP_NAME = "Event Entry";

// Client-safe helpers. The site address itself is decided on the server (lib/siteUrl.ts) and handed
// to client components through <SiteUrlProvider> / useSiteUrl().

export function joinInvite(base: string, code: string): string {
  return `${base}/invite/${code}`;
}

export function joinUsher(base: string, token: string): string {
  return `${base}/scan/join/${token}`;
}

/** True when links would point at this computer only (they won't open on guests' phones). */
export function isLocalUrl(url: string): boolean {
  return /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.)/.test(url);
}
