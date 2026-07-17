import { Link } from '@tanstack/react-router';
import { Alert, Link as MuiLink } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';

// Raised from a plain caption to an Alert - users kept missing that toggling
// layers here actually feeds the Export Wizard and Color Planner below, since
// those two live in separate cards with no visible connection to the toggles.
export const LayerSelectionHint = ({ sx }: { sx?: SxProps<Theme> }) => (
  <Alert severity="info" icon={<LayersRoundedIcon fontSize="inherit" />} sx={{ py: 0.5, ...sx }}>
    Layer selections above control what shows up in your Export and Color Planner below.{' '}
    <MuiLink
      component={Link as any}
      to="/wiki/$categorySlug/$pageSlug"
      params={{ categorySlug: 'site-functions', pageSlug: 'pattern-layers' }}
      sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
    >
      More info
    </MuiLink>
  </Alert>
);
