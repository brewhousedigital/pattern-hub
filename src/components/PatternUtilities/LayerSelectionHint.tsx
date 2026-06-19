import { Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

export const LayerSelectionHint = ({ sx }: { sx?: SxProps<Theme> }) => (
  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', ...sx }}>
    Layer selections affect your exports and Color Planner.
  </Typography>
);
