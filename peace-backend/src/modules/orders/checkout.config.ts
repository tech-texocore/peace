// Config-driven shipping/delivery. Admin overrides live in store.settings.shipping;
// these are the fallbacks so a fresh store still checks out. No hardcoded values leak
// into logic — everything reads through resolveShipping().
export interface DeliveryMethod { key: string; label: string; fee: number; days: number }
export interface ShippingConfig {
  freeShippingThreshold: number;
  codEnabled: boolean;
  codFee: number;
  methods: DeliveryMethod[];
}

const DEFAULT_SHIPPING: ShippingConfig = {
  freeShippingThreshold: 999,
  codEnabled: true,
  codFee: 0,
  methods: [
    { key: 'standard', label: 'Standard Delivery', fee: 49, days: 5 },
    { key: 'express', label: 'Express Delivery', fee: 99, days: 2 },
  ],
};

export function resolveShipping(settings: unknown): ShippingConfig {
  const s = (settings as Record<string, unknown> | null)?.shipping as Partial<ShippingConfig> | undefined;
  if (!s) return DEFAULT_SHIPPING;
  return {
    freeShippingThreshold: typeof s.freeShippingThreshold === 'number' ? s.freeShippingThreshold : DEFAULT_SHIPPING.freeShippingThreshold,
    codEnabled: typeof s.codEnabled === 'boolean' ? s.codEnabled : DEFAULT_SHIPPING.codEnabled,
    codFee: typeof s.codFee === 'number' ? s.codFee : DEFAULT_SHIPPING.codFee,
    methods: Array.isArray(s.methods) && s.methods.length ? s.methods : DEFAULT_SHIPPING.methods,
  };
}
