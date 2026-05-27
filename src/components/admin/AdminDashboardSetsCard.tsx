import { useQueryGetAllSets } from '@/functions/database/sets';
import { AdminCardWrapper } from '@/components/admin/AdminCardWrapper';
import { alpha } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';

import StyleRoundedIcon from '@mui/icons-material/StyleRounded';

import { Box, Card, CardContent, Typography } from '@mui/material';

export const AdminDashboardSetsCard = () => {
  const { isPending, isError, error, data } = useQueryGetAllSets();
  const published = data?.filter((s) => s.is_published)?.length ?? 0;
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
                bgcolor: alpha(theme.palette.info.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                color: 'info.main',
              }}
            >
              <StyleRoundedIcon sx={{ fontSize: 18 }} />
            </Box>
          </Box>

          <Typography variant="h4" fontWeight={700} lineHeight={1} mb={0.75}>
            {(data?.length ?? 0).toLocaleString()}
          </Typography>

          <Typography variant="caption" color="text.secondary">
            {published} published · {(data?.length ?? 0) - published} draft
          </Typography>
        </AdminCardWrapper>
      </CardContent>
    </Card>
  );
};
