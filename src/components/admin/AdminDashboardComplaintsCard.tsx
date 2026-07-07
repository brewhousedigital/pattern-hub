import { useQueryGetSpaceCommandDashboardData } from '@/functions/database/admin-dashboard-data';
import { createPrettyDate } from '@/functions/utilities/dates';
import { AdminCardWrapper } from '@/components/admin/AdminCardWrapper';
import { alpha } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';

import FeedbackIcon from '@mui/icons-material/Feedback';

import { Box, Card, CardContent, Typography } from '@mui/material';

export const AdminDashboardComplaintsCard = () => {
  const { isPending, isError, error, data } = useQueryGetSpaceCommandDashboardData();
  const complaints = data?.complaints;
  const total = complaints?.totalItems ?? 0;
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
              Active Reports
            </Typography>
            <Box
              sx={{
                p: 0.75,
                borderRadius: 1.5,
                backgroundColor:
                  total > 0 ? alpha(theme.palette.error.main, 0.1) : alpha(theme.palette.text.disabled, 0.08),
                display: 'flex',
                alignItems: 'center',
                color: total > 0 ? 'error.main' : 'text.disabled',
              }}
            >
              <FeedbackIcon sx={{ fontSize: 18 }} />
            </Box>
          </Box>

          <Typography
            variant="h4"
            color={total > 0 ? 'error.main' : 'text.primary'}
            sx={{ fontWeight: 700, lineHeight: 1, mb: 0.75 }}
          >
            {total.toLocaleString()}
          </Typography>

          <Typography variant="caption" color="text.secondary">
            Latest report: {complaints?.latestCreated ? createPrettyDate(complaints.latestCreated) : 'None'}
          </Typography>
        </AdminCardWrapper>
      </CardContent>
    </Card>
  );
};
