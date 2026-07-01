import React from 'react';
import { useGlobalAuthData } from '@/data/auth-data';
import { MeasurementDisplay } from '@/components/MeasurementDisplay';
import { resolvePatternDimension, type PatternSizeFields } from '@/functions/utilities/format-measurement';

type PatternMeasurementProps = {
  pattern: PatternSizeFields | undefined;
  dimension: 'width' | 'height';
};

// Preference-aware wrapper around MeasurementDisplay for a pattern's width or
// height. Reads the viewer's "preferred units" profile setting and swaps in
// the matching precomputed size_width_*/size_height_* conversion instead of
// the pattern's native design_width/design_height + unit - falling back to
// native whenever there's no preference (logged-out visitors, or users who
// haven't set one) so existing behavior is unchanged by default.
export const PatternMeasurement = ({ pattern, dimension }: PatternMeasurementProps) => {
  const { authData } = useGlobalAuthData();
  const preferredUnit = authData?.preferred_measurement_unit ?? 'original';

  if (!pattern) return <>-</>;

  const { value, unit } = resolvePatternDimension(pattern, dimension, preferredUnit);
  return <MeasurementDisplay value={value} unit={unit} />;
};
