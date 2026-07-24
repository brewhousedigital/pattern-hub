import { Box, Typography } from '@mui/material';

// Shown by trend/breakdown/radar cards before the first snapshot exists yet
// (or before enough snapshots exist to chart a comparison).
export const EmptyChartNotice = ({ message = 'Not enough data yet' }: { message?: string }) => (
  <Box
    sx={{
      minHeight: 120,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      border: '1.5px dashed',
      borderColor: 'divider',
      borderRadius: 1.5,
    }}
  >
    <Typography variant="caption" color="text.disabled">
      {message}
    </Typography>
  </Box>
);
