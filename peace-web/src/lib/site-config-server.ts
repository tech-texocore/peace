import { cache } from "react";
import { env } from "@/lib/config/env";
import { siteConfig as fallback, type SiteConfig } from "@/lib/site-config";

// Fetches the published storefront config for the store, falling back to the
// bundled default if the API is unavailable. Cached per request.
export const getSiteConfig = cache(async (): Promise<SiteConfig> => {
  try {
    const res = await fetch(`${env.apiBaseUrl}/site-config/published/${env.storeSlug}`, {
      cache: "no-store",
    });
    if (!res.ok) return fallback;
    const body = await res.json();
    return { ...fallback, ...(body?.data ?? {}) } as SiteConfig;
  } catch {
    return fallback;
  }
});
