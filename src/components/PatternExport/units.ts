// units.ts
// Convert any supported unit to absolute pixels at a given DPI.
// 'px' is unit-less w.r.t. DPI — passes through.
// 1 in = 2.54 cm = 25.4 mm. DPI = pixels per inch.

export type TypePatternExportUnit = 'in' | 'cm' | 'mm' | 'px';

const INCHES_PER_UNIT: Record<Exclude<TypePatternExportUnit, 'px'>, number> = {
  in: 1,
  cm: 1 / 2.54,
  mm: 1 / 25.4,
};

export function toPx(value: number, unit: TypePatternExportUnit, dpi: number): number {
  if (unit === 'px') return value;
  return value * INCHES_PER_UNIT[unit] * dpi;
}

// Normalize possibly-mismatched DB unit strings ('inches', 'in', 'inch'...)
export function normalizeUnit(raw: string): TypePatternExportUnit {
  const v = raw.toLowerCase().trim();
  if (v.startsWith('in')) return 'in';
  if (v.startsWith('cm') || v === 'centimeter' || v === 'centimeters') return 'cm';
  if (v.startsWith('mm') || v === 'millimeter' || v === 'millimeters') return 'mm';
  return 'px';
}
