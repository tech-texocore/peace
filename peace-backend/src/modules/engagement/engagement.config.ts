export interface EngagementConfig {
  abandonedCartHours: number;
  abandonedCartMaxAgeHours: number;
  priceDropMinPercent: number;
}

const DEFAULTS: EngagementConfig = {
  abandonedCartHours: 6,
  abandonedCartMaxAgeHours: 168,
  priceDropMinPercent: 1,
};

const num = (v: unknown, fallback: number, min = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= min ? n : fallback;
};

export function resolveEngagement(settings: unknown): EngagementConfig {
  const s = (settings as Record<string, unknown> | null)?.engagement as Partial<EngagementConfig> | undefined;
  return {
    abandonedCartHours: num(s?.abandonedCartHours, DEFAULTS.abandonedCartHours, 1),
    abandonedCartMaxAgeHours: num(s?.abandonedCartMaxAgeHours, DEFAULTS.abandonedCartMaxAgeHours, 1),
    priceDropMinPercent: num(s?.priceDropMinPercent, DEFAULTS.priceDropMinPercent, 0),
  };
}
