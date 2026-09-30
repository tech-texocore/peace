import { resolve } from "path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Project-wide config: loads the root .env.development / .env.production shared with the backend.
loadEnvConfig(resolve(process.cwd(), ".."), process.env.NODE_ENV !== "production", undefined, true);
const env = process.env;
process.env.API_INTERNAL_URL ??= `http://127.0.0.1:${env.API_PORT ?? 4000}/${env.API_PREFIX ?? "api"}`;

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  // Only these values are exposed to the browser.
  env: {
    NEXT_PUBLIC_API_BASE_URL: `${env.API_URL ?? "http://localhost:4000"}/${env.API_PREFIX ?? "api"}`,
    NEXT_PUBLIC_APP_NAME: env.STORE_NAME ?? "Peace",
    NEXT_PUBLIC_STORE_SLUG: env.STORE_SLUG ?? "peace",
    NEXT_PUBLIC_FIREBASE_API_KEY: env.FIREBASE_API_KEY ?? "",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: env.FIREBASE_AUTH_DOMAIN ?? "",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID ?? "",
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: env.FIREBASE_STORAGE_BUCKET ?? "",
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: env.FIREBASE_MESSAGING_SENDER_ID ?? "",
    NEXT_PUBLIC_FIREBASE_APP_ID: env.FIREBASE_APP_ID ?? "",
  },
  // Serves Firebase's sign-in handler from our own domain, so Google shows "continue to <our domain>"
  // once FIREBASE_AUTH_DOMAIN is set to the site's domain.
  async rewrites() {
    if (!env.FIREBASE_PROJECT_ID) return [];
    return [{ source: "/__/auth/:path*", destination: `https://${env.FIREBASE_PROJECT_ID}.firebaseapp.com/__/auth/:path*` }];
  },
};

export default nextConfig;
