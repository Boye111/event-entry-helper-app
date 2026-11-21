import "server-only";
import { isLocalUrl, joinInvite, joinUsher } from "./site";

function clean(url: string): string {
  const u = url.trim().replace(/\/+$/, "");
  return /^https?:\/\//.test(u) ? u : `https://${u}`;
}

/**
 * The public address that goes inside every QR code and invite link. Read on the server at request time,
 * so nothing has to be baked into the browser bundle. First match wins:
 *  1. SITE_URL                       - set this only for a custom domain
 *  2. NEXT_PUBLIC_SITE_URL           - older setups (still honoured)
 *  3. VERCEL_PROJECT_PRODUCTION_URL  - filled in by Vercel automatically, e.g. my-app.vercel.app
 *  4. http://localhost:3000          - local development
 */
export function siteUrl(): string {
  const fromEnv = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  // On Vercel a leftover localhost value would break every invite, so prefer Vercel's own address then.
  if (fromEnv && !(process.env.VERCEL && isLocalUrl(clean(fromEnv)))) return clean(fromEnv);
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return clean(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  return "http://localhost:3000";
}

export function inviteUrl(code: string): string {
  return joinInvite(siteUrl(), code);
}

export function usherUrl(token: string): string {
  return joinUsher(siteUrl(), token);
}

export function siteUrlIsLocal(): boolean {
  return isLocalUrl(siteUrl());
}
