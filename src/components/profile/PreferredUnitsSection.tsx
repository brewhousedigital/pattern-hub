import React from 'react';
import { ToggleButton, ToggleButtonGroup, Typography, useMediaQuery, useTheme } from '@mui/material';
import { SectionCard, SectionHeader, type SectionCustProps } from './_shared';

const UNIT_OPTIONS = [
  { value: 'original', label: 'Original' },
  { value: 'in', label: 'Inches' },
  { value: 'in-fraction', label: 'Inches Fractional' },
  { value: 'cm', label: 'Centimeters' },
  { value: 'mm', label: 'Millimeters' },
] as const;

export const PreferredUnitsSection = ({ customization, setCust, onReset }: SectionCustProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <SectionCard elevation={0}>
      <SectionHeader title="Preferred Units" onReset={onReset} />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Choose how pattern sizes are displayed across the site. "Original" shows each pattern in the unit it was
        uploaded with.
      </Typography>
      <ToggleButtonGroup
        orientation={isMobile ? 'vertical' : 'horizontal'}
        exclusive
        value={customization.preferred_measurement_unit}
        onChange={(_, v) => {
          if (v) setCust('preferred_measurement_unit', v);
        }}
        size="small"
      >
        {UNIT_OPTIONS.map((opt) => (
          <ToggleButton key={opt.value} value={opt.value} sx={{ textTransform: 'none', fontWeight: 600, px: 2 }}>
            {opt.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </SectionCard>
  );
};
