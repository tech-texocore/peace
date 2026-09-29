type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
    __metaPending?: unknown[][];
  }
}

// Events fired before the Pixel script loads are queued and flushed when it starts.
export function trackMeta(event: string, params: Record<string, unknown> = {}, eventId?: string) {
  if (typeof window === "undefined") return;
  const args: unknown[] = ["track", event, params, ...(eventId ? [{ eventID: eventId }] : [])];
  if (window.fbq) window.fbq(...args);
  else (window.__metaPending ??= []).push(args);
}

export function metaTracking() {
  if (typeof document === "undefined") return undefined;
  const cookie = (name: string) => document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1];
  return { fbp: cookie("_fbp"), fbc: cookie("_fbc"), url: window.location.href };
}
