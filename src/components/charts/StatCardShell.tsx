import type { ReactNode } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import { Box, Card, CardContent, Typography } from '@mui/material';

type Props = {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
};

// Factors out the Card + eyebrow-icon-label recipe already established in
// AdminDashboardUsersCard.tsx so every stats card (admin or community) shares
// the same visual language. Purely presentational - no data fetching, no
// localStorage, no drag-and-drop.
export const StatCardShell = ({ title, icon, action, children }: Props) => {
  const theme = useTheme();

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, gap: 1 }}>
          <Typography
            sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}
            color="text.secondary"
          >
            {title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
            {action}
            <Box
              sx={{
                p: 0.75,
                borderRadius: 1.5,
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                color: 'primary.main',
              }}
            >
              {icon}
            </Box>
          </Box>
        </Box>
        {children}
      </CardContent>
    </Card>
  );
};
