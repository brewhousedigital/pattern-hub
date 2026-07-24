import { alpha } from '@mui/material/styles';
import { PRIMARY_COLOR } from '@/data/constants';

// The single hue used for plain magnitude trends (patterns/users/tags/exports
// over time) and the export-time intensity grid - derived from the app's own
// brand green via alpha() steps, the established idiom already used in
// AdminDashboardUsersCard.tsx and mui-theme.ts, rather than introducing an
// unrelated hue that would look disconnected from the rest of the admin UI.
export const CHART_PRIMARY = PRIMARY_COLOR;

export const sequentialStep = (step: number): string => alpha(PRIMARY_COLOR, Math.min(1, Math.max(0.08, step)));

// Fixed-order categorical palette for breakdown charts (export file type,
// export flow). Assigned by identity - series always take the same color
// regardless of a filter changing which categories are present, never
// re-cycled/reassigned by rank.
export const CATEGORICAL_PALETTE = [
  '#0b6536', // brand green
  '#c77b30', // amber
  '#2f6f9e', // slate blue
  '#a0447a', // plum
  '#c2a83e', // gold
  '#5b7f4f', // moss
  '#8a4b3b', // clay
  '#4b5a70', // steel
];

// Status colors for genuinely valenced metrics (growth up = good, down = bad)
// - not a generic categorical pair, since up/down here is good/bad, not identity.
export const STATUS_POSITIVE = '#0b6536';
export const STATUS_NEGATIVE = '#d03b3b';
export const STATUS_NEUTRAL = '#9aa0a6';
