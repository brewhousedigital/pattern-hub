import React from 'react';
import { Box } from '@mui/material';
import { computeInchesFraction, isInchUnit, formatMeasurement } from '@/functions/utilities/format-measurement';

type MeasurementDisplayProps = {
  value: number | null | undefined;
  unit: string | null | undefined;
  denominator?: number;
  /** Renders a plain decimal even for inch units - used for the "Inches" (non-fractional) preference. */
  forceDecimal?: boolean;
};

// Renders a stored (value, unit) measurement for on-screen display. Inches
// render as a real stacked fraction (numerator over denominator with a bar,
// textbook style) instead of inline "15/16" text. Every other unit falls
// back to the same plain-decimal formatting used everywhere else in the app.
//
// React-only. Exported files (SVG/PDF/PNG legends) keep using the plain-text
// formatInchesAsFraction()/formatMeasurement() from format-measurement.ts -
// a stacked fraction needs real DOM layout, which SVG <text>/canvas output
// baked into a download can't reproduce.
export const MeasurementDisplay = ({ value, unit, denominator, forceDecimal }: MeasurementDisplayProps) => {
  if (value == null || isNaN(value)) return <>-</>;

  if (forceDecimal || !isInchUnit(unit ?? '')) {
    return <>{formatMeasurement(value, unit, { forceDecimal })}</>;
  }

  const { sign, whole, numerator, denominator: denom } = computeInchesFraction(value, denominator);
  const showWhole = numerator === 0 || whole !== 0;

  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
      {sign}
      {showWhole && (
        <Box component="span" sx={{ mr: numerator !== 0 ? '3px' : 0 }}>
          {whole}
        </Box>
      )}
      {numerator !== 0 && <StackedFraction numerator={numerator} denominator={denom} />}
      <Box component="span" sx={{ ml: '3px' }}>
        in
      </Box>
    </Box>
  );
};

const StackedFraction = ({ numerator, denominator }: { numerator: number; denominator: number }) => (
  <Box
    component="span"
    sx={{
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontSize: '0.68em',
      lineHeight: 1,
      verticalAlign: 'middle',
      transform: 'translateY(-0.05em)',
    }}
  >
    <Box component="span" sx={{ px: '1px', borderBottom: '1.2px solid currentColor' }}>
      {numerator}
    </Box>
    <Box component="span" sx={{ px: '1px' }}>
      {denominator}
    </Box>
  </Box>
);
