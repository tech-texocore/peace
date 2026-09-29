// Config-driven shipping/delivery. Admin overrides live in store.settings.shipping;
// these are the fallbacks so a fresh store still checks out.
export interface DeliveryMethod {
  key: string;
  label: string;
  fee: number;
  days: number;
  enabled: boolean;
}
export interface ShippingConfig {
  freeForAll: boolean;
  // 0 = no minimum-order free delivery.
  freeShippingThreshold: number;
  codEnabled: boolean;
  codFee: number;
  methods: DeliveryMethod[];
}

const DEFAULT_METHODS: DeliveryMethod[] = [
  {
    key: 'standard',
    label: 'Standard Delivery',
    fee: 49,
    days: 5,
    enabled: true,
  },
  {
    key: 'express',
    label: 'Express Delivery',
    fee: 99,
    days: 2,
    enabled: true,
  },
];

const DEFAULT_SHIPPING: ShippingConfig = {
  freeForAll: false,
  freeShippingThreshold: 999,
  codEnabled: true,
  codFee: 0,
  methods: DEFAULT_METHODS,
};

const amount = (v: unknown, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback;

function resolveMethods(raw: unknown, includeDisabled: boolean): DeliveryMethod[] {
  if (!Array.isArray(raw)) return DEFAULT_METHODS;
  return raw
    .filter((m): m is Partial<DeliveryMethod> => !!m && typeof m === 'object')
    .filter(
      (m) =>
        typeof m.key === 'string' &&
        m.key &&
        typeof m.label === 'string' &&
        m.label.trim(),
    )
    .map((m) => ({
      key: m.key!,
      label: m.label!.trim(),
      fee: amount(m.fee, 0),
      days: Math.max(1, Math.round(amount(m.days, 1))),
      enabled: m.enabled !== false,
    }))
    .filter((m) => includeDisabled || m.enabled);
}

// includeDisabled keeps switched-off delivery options (the admin editor needs them; checkout does not).
export function resolveShipping(settings: unknown, includeDisabled = false): ShippingConfig {
  const s = (settings as Record<string, unknown> | null)?.shipping as
    Partial<ShippingConfig> | undefined;
  if (!s) return DEFAULT_SHIPPING;
  return {
    freeForAll: s.freeForAll === true,
    freeShippingThreshold: amount(
      s.freeShippingThreshold,
      DEFAULT_SHIPPING.freeShippingThreshold,
    ),
    codEnabled:
      typeof s.codEnabled === 'boolean'
        ? s.codEnabled
        : DEFAULT_SHIPPING.codEnabled,
    codFee: amount(s.codFee, DEFAULT_SHIPPING.codFee),
    methods: resolveMethods(s.methods, includeDisabled),
  };
}

export function qualifiesForFreeDelivery(
  shipping: ShippingConfig,
  orderTotal: number,
  couponFree = false,
) {
  if (couponFree || shipping.freeForAll) return true;
  return (
    shipping.freeShippingThreshold > 0 &&
    orderTotal >= shipping.freeShippingThreshold
  );
}
