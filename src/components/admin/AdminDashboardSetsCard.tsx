import { useQueryGetSpaceCommandDashboardData } from '@/functions/database/admin-dashboard-data';
import { AdminCardWrapper } from '@/components/admin/AdminCardWrapper';
import { alpha } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';

import StyleRoundedIcon from '@mui/icons-material/StyleRounded';

import { Box, Card, CardContent, Typography } from '@mui/material';

export const AdminDashboardSetsCard = () => {
  const { isPending, isError, error, data } = useQueryGetSpaceCommandDashboardData();
  const sets = data?.sets;
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
              Sets
            </Typography>
            <Box
              sx={{
                p: 0.75,
                borderRadius: 1.5,
                backgroundColor: alpha(theme.palette.info.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                color: 'info.main',
              }}
            >
              <StyleRoundedIcon sx={{ fontSize: 18 }} />
            </Box>
          </Box>

          <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1, mb: 0.75 }}>
            {(sets?.totalItems ?? 0).toLocaleString()}
          </Typography>

          <Typography variant="caption" color="text.secondary">
            {sets?.published ?? 0} published · {sets?.draft ?? 0} draft
          </Typography>
        </AdminCardWrapper>
      </CardContent>
    </Card>
  );
};
