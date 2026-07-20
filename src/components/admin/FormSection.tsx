import { Box, Divider, Typography } from '@mui/material';

// Shared section-label divider used across the admin pattern-editing surfaces
// (AdminEditPatternModal, PatternEditFields) to keep form groupings consistent.
export const FormSection = ({ label }: { label: string }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 0.5 }}>
    <Typography
      sx={{
        whiteSpace: 'nowrap',
        fontSize: '0.67rem',
        fontWeight: 700,
        letterSpacing: '0.09em',
        textTransform: 'uppercase',
        color: 'text.disabled',
      }}
    >
      {label}
    </Typography>
    <Divider sx={{ flex: 1 }} />
  </Box>
);
