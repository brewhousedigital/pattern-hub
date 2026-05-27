import { useQueryAdminTagStatsPaginated } from '@/functions/database/tags';
import { AdminCardWrapper } from '@/components/admin/AdminCardWrapper';
import { alpha } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';

import LocalOfferRoundedIcon from '@mui/icons-material/LocalOfferRounded';

import { Box, Card, CardContent, Typography } from '@mui/material';

export const AdminDashboardTagsCard = () => {
  const { isPending, isError, error, data } = useQueryAdminTagStatsPaginated({
    page: 0,
    pageSize: 1,
    search: '',
    sortField: 'count',
    sortDir: 'desc',
  });
  const topTag = data?.items?.[0];
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
              Tags
            </Typography>
            <Box
              sx={{
                p: 0.75,
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.warning.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                color: 'warning.main',
              }}
            >
              <LocalOfferRoundedIcon sx={{ fontSize: 18 }} />
            </Box>
          </Box>

          <Typography variant="h4" fontWeight={700} lineHeight={1} mb={0.75}>
            {(data?.totalItems ?? 0).toLocaleString()}
          </Typography>

          <Typography variant="caption" color="text.secondary">
            Most used:{' '}
            {topTag ? (
              <>
                <strong>{topTag.tag}</strong> ({topTag.count.toLocaleString()})
              </>
            ) : (
              '—'
            )}
          </Typography>
        </AdminCardWrapper>
      </CardContent>
    </Card>
  );
};
