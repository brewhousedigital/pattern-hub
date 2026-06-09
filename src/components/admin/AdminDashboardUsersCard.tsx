import { useQueryUsersByPagination } from '@/functions/database/users.ts';
import { createPrettyDate } from '@/functions/utilities/dates';
import { AdminCardWrapper } from '@/components/admin/AdminCardWrapper';
import { alpha } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';

import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';

import { Box, Card, CardContent, Typography } from '@mui/material';

export const AdminDashboardUsersCard = () => {
  const { isPending, isError, error, data } = useQueryUsersByPagination(1);
  const firstItem = data?.items?.[0];
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
              Users
            </Typography>
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
              <PeopleRoundedIcon sx={{ fontSize: 18 }} />
            </Box>
          </Box>

          <Typography variant="h4" fontWeight={700} lineHeight={1} mb={0.75}>
            {(data?.totalItems ?? 0).toLocaleString()}
          </Typography>

          <Typography variant="caption" color="text.secondary">
            Newest registration: {firstItem?.created ? createPrettyDate(firstItem.created) : '—'}
          </Typography>
        </AdminCardWrapper>
      </CardContent>
    </Card>
  );
};
