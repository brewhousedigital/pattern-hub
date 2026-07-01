// format-measurement.ts
// Renders a stored (value, unit) measurement the way a crafter would want to
// read it: inches as a whole number + reduced fraction (e.g. "8 15/16 in"),
// matching how these sizes are usually marked on a ruler. Every other unit
// (cm, mm, px, ...) stays a plain decimal - unchanged from prior behavior.

const DEFAULT_DENOMINATOR = 32; // nearest 1/32" - standard ruler/craft precision

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

export interface InchesFraction {
  sign: '' | '-';
  whole: number;
  /** 0 when the value is a whole number - i.e. no fraction to show. */
  numerator: number;
  denominator: number;
}

/**
 * Core computation shared by the plain-text formatter (below) and the
 * stacked-fraction React component (MeasurementDisplay.tsx). Converts a
 * decimal number of inches into whole + reduced numerator/denominator,
 * e.g. 8.9375 -> { sign: '', whole: 8, numerator: 15, denominator: 16 }
 * (denominator defaults to 32nds, but 15/16 = 30/32 reduces to the same thing).
 */
export function computeInchesFraction(value: number, denominator: number = DEFAULT_DENOMINATOR): InchesFraction {
  if (!isFinite(value)) return { sign: '', whole: 0, numerator: 0, denominator };

  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);

  let whole = Math.trunc(abs);
  let numerator = Math.round((abs - whole) * denominator);
  const denom = denominator;

  // Rounding can push the numerator up to a whole unit (e.g. 15.97/16 -> 16/16).
  if (numerator === denom) {
    numerator = 0;
    whole += 1;
  }

  if (numerator === 0) {
    return { sign, whole, numerator: 0, denominator: denom };
  }

  const divisor = gcd(numerator, denom);
  return { sign, whole, numerator: numerator / divisor, denominator: denom / divisor };
}

/**
 * Converts a decimal number of inches into "whole numerator/denominator" form,
 * e.g. 8.9375 -> "8 15/16", 0.5 -> "1/2", 16 -> "16".
 * Fractions are reduced to lowest terms; denominator defaults to 32nds.
 */
export function formatInchesAsFraction(value: number, denominator: number = DEFAULT_DENOMINATOR): string {
  const { sign, whole, numerator, denominator: denom } = computeInchesFraction(value, denominator);

  if (numerator === 0) return `${sign}${whole}`;
  return whole === 0 ? `${sign}${numerator}/${denom}` : `${sign}${whole} ${numerator}/${denom}`;
}

export function isInchUnit(unit: string): boolean {
  const u = unit.toLowerCase().trim();
  return u === 'in' || u === 'inch' || u === 'inches' || u === '"';
}

/**
 * Formats a stored measurement for display. Inches render as a fraction
 * (e.g. "16 1/2 in"); every other unit (cm, mm, px, ...) renders as a
 * trimmed decimal, matching the app's existing convention for those units.
 * Returns "-" for null/undefined/NaN, matching existing "no value" display.
 */
export function formatMeasurement(
  value: number | null | undefined,
  unit: string | null | undefined,
  opts?: { denominator?: number },
): string {
  if (value == null || isNaN(value)) return '-';

  if (isInchUnit(unit ?? '')) {
    return `${formatInchesAsFraction(value, opts?.denominator)} in`;
  }

  // Trim to 3 decimal places, stripping trailing zeros (e.g. 5.500 -> 5.5).
  const rounded = Number(value.toFixed(3));
  return `${rounded}${unit ?? ''}`;
}

// ─── Preferred-unit resolution ────────────────────────────────────────────────
//
// Patterns store their "native" size as design_width/design_width_unit (the
// unit whoever uploaded it authored it in), plus six precomputed conversions
// (size_width_in/cm/mm, size_height_in/cm/mm) generated at upload time -
// currently only used for admin search filters. A user's preferred-unit
// profile setting substitutes the matching precomputed field in for display,
// falling back to the native value/unit when there's no preference or the
// precomputed field is missing (older patterns saved before it existed).

export type PreferredUnit = 'original' | 'in' | 'cm' | 'mm';

export interface PatternSizeFields {
  design_width: number;
  design_width_unit: string;
  design_height: number;
  design_height_unit: string;
  size_width_in?: number;
  size_width_cm?: number;
  size_width_mm?: number;
  size_height_in?: number;
  size_height_cm?: number;
  size_height_mm?: number;
}

export function resolvePatternDimension(
  pattern: PatternSizeFields,
  dimension: 'width' | 'height',
  preferredUnit: PreferredUnit,
): { value: number; unit: string } {
  const native =
    dimension === 'width'
      ? { value: pattern.design_width, unit: pattern.design_width_unit }
      : { value: pattern.design_height, unit: pattern.design_height_unit };

  if (preferredUnit === 'original') return native;

  const precomputed =
    dimension === 'width'
      ? preferredUnit === 'in'
        ? pattern.size_width_in
        : preferredUnit === 'cm'
          ? pattern.size_width_cm
          : pattern.size_width_mm
      : preferredUnit === 'in'
        ? pattern.size_height_in
        : preferredUnit === 'cm'
          ? pattern.size_height_cm
          : pattern.size_height_mm;

  if (typeof precomputed === 'number' && !isNaN(precomputed)) {
    return { value: precomputed, unit: preferredUnit };
  }

  return native;
}
