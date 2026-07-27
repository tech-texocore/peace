export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'inApp';

export interface NotificationCategory {
  key: string;
  label: string;
  description: string;
  transactional?: boolean;
}

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  { key: 'orderUpdates', label: 'Order updates', description: 'Confirmation, packed, shipped, delivered and returns', transactional: true },
  { key: 'priceDrop', label: 'Price drops', description: 'When something you saved or added to cart gets cheaper' },
  { key: 'backInStock', label: 'Back in stock', description: 'When a sold-out item you want is available again' },
  { key: 'abandonedCart', label: 'Cart reminders', description: 'A gentle nudge when you leave items in your bag' },
  { key: 'promotions', label: 'Offers & promotions', description: 'Sales, coupons and campaigns' },
  { key: 'newsletter', label: 'Newsletter', description: 'New arrivals, drops and stories' },
];

export type NotificationPrefs = Record<string, boolean>;

export function defaultPrefs(): NotificationPrefs {
  return Object.fromEntries(NOTIFICATION_CATEGORIES.map((c) => [c.key, true]));
}

export function normalizePrefs(raw: unknown): NotificationPrefs {
  const stored = (raw ?? {}) as Record<string, unknown>;
  const out: NotificationPrefs = {};
  for (const c of NOTIFICATION_CATEGORIES) {
    out[c.key] = c.transactional ? true : stored[c.key] !== false;
  }
  return out;
}

export function categoryEnabled(prefs: NotificationPrefs, key: string): boolean {
  const cat = NOTIFICATION_CATEGORIES.find((c) => c.key === key);
  if (cat?.transactional) return true;
  return prefs[key] !== false;
}

interface ChannelUser {
  emailOptIn: boolean;
  smsOptIn: boolean;
  whatsappOptIn: boolean;
  notificationPrefs?: unknown;
}

export function wants(user: ChannelUser, category: string, channel: NotificationChannel): boolean {
  if (!categoryEnabled(normalizePrefs(user.notificationPrefs), category)) return false;
  if (channel === 'inApp') return true;
  if (channel === 'email') return user.emailOptIn;
  if (channel === 'sms') return user.smsOptIn;
  return user.whatsappOptIn;
}
