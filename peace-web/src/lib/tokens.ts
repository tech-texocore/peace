/**
 * Design tokens — single source of truth for layout, spacing, radii, and type.
 * Import these presets in components instead of repeating class strings, so the
 * whole app stays uniform. Change a value here and it updates everywhere.
 */

// Horizontal page frame (max width + responsive gutters)
export const container = "mx-auto w-full max-w-[1800px] px-4 sm:px-5 lg:px-6";

// Vertical rhythm for sections
export const space = {
  section: "py-6 lg:py-8",
  sectionTight: "py-4 lg:py-6",
} as const;

// Grid / flex gaps
export const gap = {
  grid: "gap-3 lg:gap-4",
  gridProducts: "gap-x-3 gap-y-6 lg:gap-x-4 lg:gap-y-8",
} as const;

// Corner radii
export const radius = {
  card: "rounded-2xl",
  panel: "rounded-[2rem]",
  pill: "rounded-full",
} as const;

// Surfaces
export const surface = {
  card: "rounded-2xl border border-line bg-card",
  soft: "rounded-2xl bg-accent-soft",
} as const;

// Typography presets
export const type = {
  eyebrow: "text-xs font-semibold uppercase tracking-[0.2em] text-accent",
  h1: "font-display font-medium leading-[1.05] tracking-tight text-5xl sm:text-6xl lg:text-7xl",
  h2: "font-display font-medium tracking-tight text-3xl sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]",
  h3: "font-display text-lg",
  label: "text-xs font-semibold uppercase tracking-widest",
  muted: "text-sm text-muted",
} as const;

// Small interactive elements
export const control = {
  iconButton: "rounded-full p-2.5 hover:bg-accent-soft",
  chip: "rounded-full bg-ink px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-canvas",
} as const;
