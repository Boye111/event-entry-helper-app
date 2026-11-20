/** Product name shown in the UI and page titles. Change it here to rename the app everywhere. */
export const APP_NAME = "Event Entry";

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function inviteUrl(code: string): string {
  return `${siteUrl()}/invite/${code}`;
}

export function usherUrl(token: string): string {
  return `${siteUrl()}/scan/join/${token}`;
}

/** True when invite links would point at this computer only (they won't open on guests' phones). */
export function siteUrlIsLocal(): boolean {
  return /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.)/.test(siteUrl());
}
