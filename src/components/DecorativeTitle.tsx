import React from 'react';
import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { TypeComponentWithChildrenProps } from '@/functions/types/types';

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
