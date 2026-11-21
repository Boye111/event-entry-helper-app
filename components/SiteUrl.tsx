"use client";

import { createContext, useContext } from "react";

const SiteUrlContext = createContext("http://localhost:3000");

/** Gives client components the server-decided site address (see lib/siteUrl.ts). */
export function SiteUrlProvider({ value, children }: { value: string; children: React.ReactNode }) {
  return <SiteUrlContext.Provider value={value}>{children}</SiteUrlContext.Provider>;
}

export function useSiteUrl(): string {
  return useContext(SiteUrlContext);
}
