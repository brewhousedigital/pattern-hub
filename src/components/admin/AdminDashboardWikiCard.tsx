import { useQueryGetSpaceCommandDashboardData } from '@/functions/database/admin-dashboard-data';
import { createPrettyDate } from '@/functions/utilities/dates';
import { AdminCardWrapper } from '@/components/admin/AdminCardWrapper';
import { alpha, useTheme } from '@mui/material/styles';

import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';

import { Box, Card, CardContent, Divider, Stack, Typography } from '@mui/material';

export const AdminDashboardWikiCard = () => {
  const { isPending, isError, error, data } = useQueryGetSpaceCommandDashboardData();
  const wiki = data?.wiki;
  const theme = useTheme();

  const catCount = wiki?.categoryCount ?? 0;
  const pageCount = wiki?.pageCount ?? 0;

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <AdminCardWrapper isPending={isPending} isError={isError} error={error}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
            <Typography
              sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}
              color="text.secondary"
            >
              Wiki
            </Typography>
            <Box
              sx={{
                p: 0.75,
                borderRadius: 1.5,
                backgroundColor: alpha(theme.palette.warning.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                color: 'warning.main',
              }}
            >
              <AutoStoriesRoundedIcon sx={{ fontSize: 18 }} />
            </Box>
          </Box>

          <Stack direction="row" divider={<Divider orientation="vertical" flexItem />} spacing={2}>
            <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1, mb: 0.25 }}>
              {catCount.toLocaleString()}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1, mb: 0.25 }}>
              {pageCount.toLocaleString()}
            </Typography>
          </Stack>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
            {catCount} {catCount === 1 ? 'category' : 'categories'}, {pageCount} {pageCount === 1 ? 'page' : 'pages'}
          </Typography>

          <Typography variant="caption" color="text.secondary">
            Last updated: {wiki?.lastUpdated ? createPrettyDate(wiki.lastUpdated) : '-'}
          </Typography>
        </AdminCardWrapper>
      </CardContent>
    </Card>
  );
};
