export type GlassColor = { label: string; hex: string };

export const STAINED_GLASS_COLORS: GlassColor[] = [
  { label: 'Ruby', hex: '#c0152a' },
  { label: 'Cobalt', hex: '#1a3aad' },
  { label: 'Amber', hex: '#d97706' },
  { label: 'Emerald', hex: '#057a44' },
  { label: 'Sapphire', hex: '#1d6fa4' },
  { label: 'Violet', hex: '#6b21a8' },
  { label: 'Rose', hex: '#db2777' },
  { label: 'Clear', hex: '#e8f4f8' },
  { label: 'Frost', hex: '#dce8f0' },
  { label: 'Ochre', hex: '#b45309' },
  { label: 'Teal', hex: '#0f766e' },
  { label: 'Plum', hex: '#86198f' },
  { label: 'Gold', hex: '#ca8a04' },
  { label: 'Smoke', hex: '#6b7280' },
];

// ─── Environment presets ──────────────────────────────────────────────────────
// Mapped to a friendly label for the background selector UI.
// Presets come from @react-three/drei's built-in HDR library.

export type EnvPreset =
  | 'sunset'
  | 'dawn'
  | 'park'
  | 'forest'
  | 'city'
  | 'apartment'
  | 'lobby'
  | 'studio'
  | 'night'
  | 'warehouse';

export const ENV_OPTIONS: { preset: EnvPreset; label: string; outdoor: boolean }[] = [
  { preset: 'sunset', label: 'Sunset', outdoor: true },
  { preset: 'dawn', label: 'Dawn', outdoor: true },
  { preset: 'park', label: 'Garden', outdoor: true },
  { preset: 'forest', label: 'Forest', outdoor: true },
  { preset: 'city', label: 'City', outdoor: true },
  { preset: 'night', label: 'Night', outdoor: true },
  { preset: 'apartment', label: 'Living Room', outdoor: false },
  { preset: 'lobby', label: 'Interior', outdoor: false },
  { preset: 'studio', label: 'Studio', outdoor: false },
  { preset: 'warehouse', label: 'Workshop', outdoor: false },
];
