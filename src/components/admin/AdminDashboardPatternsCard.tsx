import { useQueryGetSpaceCommandDashboardData } from '@/functions/database/admin-dashboard-data';
import { createPrettyDate } from '@/functions/utilities/dates';
import { AdminCardWrapper } from '@/components/admin/AdminCardWrapper';
import { alpha } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';

import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';

import { Box, Card, CardContent, Typography } from '@mui/material';

export const AdminDashboardPatternsCard = () => {
  const { isPending, isError, error, data } = useQueryGetSpaceCommandDashboardData();
  const patterns = data?.patterns;
  const theme = useTheme();

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <AdminCardWrapper isPending={isPending} isError={isError} error={error}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
            <Typography
              sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}
              color="text.secondary"
            >
              Patterns
            </Typography>
            <Box
              sx={{
                p: 0.75,
                borderRadius: 1.5,
                backgroundColor: alpha(theme.palette.success.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                color: 'success.main',
              }}
            >
              <ExtensionRoundedIcon sx={{ fontSize: 18 }} />
            </Box>
          </Box>

          <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1, mb: 0.75 }}>
            {(patterns?.totalItems ?? 0).toLocaleString()}
          </Typography>

          <Typography variant="caption" color="text.secondary">
            Newest added: {patterns?.newestCreated ? createPrettyDate(patterns.newestCreated) : '-'}
          </Typography>
        </AdminCardWrapper>
      </CardContent>
    </Card>
  );
};
