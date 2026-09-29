import { cache } from "react";
import { apiBase, env } from "@/lib/config/env";
import { siteConfig as fallback, type SiteConfig } from "@/lib/site-config";

// Fetches the published storefront config for the store, falling back to the
// bundled default if the API is unavailable. Cached per request.
export const getSiteConfig = cache(async (): Promise<SiteConfig> => {
  try {
    const res = await fetch(`${apiBase()}/site-config/published/${env.storeSlug}`, {
      cache: "no-store",
    });
    if (!res.ok) return fallback;
    const body = await res.json();
    return { ...fallback, ...(body?.data ?? {}) } as SiteConfig;
  } catch {
    return fallback;
  }
});

// The Pixel ID is written into a script tag, so only numeric IDs are accepted.
type TrackingConfig = { metaPixelId: string | null; metaDomainVerification: string | null };

export const getTrackingConfig = cache(async (): Promise<TrackingConfig> => {
  try {
    const res = await fetch(`${apiBase()}/tracking/config`, { cache: "no-store" });
    const d = res.ok ? ((await res.json())?.data as Partial<TrackingConfig> | null) : null;
    return {
      metaPixelId: d?.metaPixelId && /^\d{5,20}$/.test(d.metaPixelId) ? d.metaPixelId : null,
      metaDomainVerification: d?.metaDomainVerification && /^[a-z0-9]{10,64}$/.test(d.metaDomainVerification) ? d.metaDomainVerification : null,
    };
  } catch {
    return { metaPixelId: null, metaDomainVerification: null };
  }
});
