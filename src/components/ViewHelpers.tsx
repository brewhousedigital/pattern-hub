import React from 'react';
import { Box, Typography, Divider } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { TypeComponentWithChildrenProps } from '@/functions/types/types';

export const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Typography
    variant="caption"
    sx={{
      color: 'primary.main',
      textTransform: 'uppercase',
      letterSpacing: '0.14em',
      fontSize: '0.68rem',
      display: 'block',
      mb: 0.5,
    }}
  >
    {children}
  </Typography>
);

export const MetaRow = ({ label, value, unit }: { label: string; value?: string | number; unit?: string }) => {
  return (
    <Box sx={{ mb: 1.5 }}>
      <SectionLabel>{label}</SectionLabel>
      <Typography variant="body1" sx={{ color: 'text.primary', lineHeight: 1.4 }}>
        {value} {unit}
      </Typography>
    </Box>
  );
};

export const ThinDivider = () => (
  <Divider
    sx={{
      borderColor: alpha('#C8A96E', 0.18),
      my: 2.5,
    }}
  />
);

export const DecorativeTitle = (props: TypeComponentWithChildrenProps) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
      <Box sx={{ height: '1px', flex: 1, bgcolor: alpha('#C8A96E', 0.2) }} />

      <Typography
        variant="caption"
        sx={{
          color: 'primary.main',
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          fontSize: '0.7rem',
        }}
      >
        {props.children}
      </Typography>

      <Box sx={{ height: '1px', flex: 1, bgcolor: alpha('#C8A96E', 0.2) }} />
    </Box>
  );
};
