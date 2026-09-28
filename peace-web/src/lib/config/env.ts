export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Peace",
  storeSlug: process.env.NEXT_PUBLIC_STORE_SLUG ?? "peace",
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  },
};

export const isFirebaseConfigured = Boolean(env.firebase.apiKey && env.firebase.projectId);

// Pages rendered on the server call the API on the same machine (no Nginx/TLS hop,
// not counted by the per-visitor rate limit). Browsers use the public URL.
export const apiBase = () => (typeof window === "undefined" && process.env.API_INTERNAL_URL) || env.apiBaseUrl;
