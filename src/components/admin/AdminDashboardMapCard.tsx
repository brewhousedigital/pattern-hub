import { alpha, useTheme } from '@mui/material/styles';

import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded';

import { Box, Card, CardContent, Chip, Typography } from '@mui/material';

export const AdminDashboardMapCard = () => {
  const theme = useTheme();

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2,
        height: '100%',
        borderStyle: 'dashed',
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Typography
            sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}
            color="text.disabled"
          >
            Map Control
          </Typography>
          <Box
            sx={{
              p: 0.75,
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.action.disabled, 0.1),
              display: 'flex',
              alignItems: 'center',
              color: 'text.disabled',
            }}
          >
            <LocationOnRoundedIcon sx={{ fontSize: 18 }} />
          </Box>
        </Box>

        <Box sx={{ mb: 0.75 }}>
          <Chip
            label="Coming Soon"
            size="small"
            variant="outlined"
            sx={{ borderColor: 'divider', color: 'text.disabled', fontSize: '0.7rem' }}
          />
        </Box>

        <Typography variant="caption" color="text.disabled">
          Map & Locator in development
        </Typography>
      </CardContent>
    </Card>
  );
};
