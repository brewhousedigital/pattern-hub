import { useQueryGetAllFAQ } from '@/functions/database/faq';
import { createPrettyDate } from '@/functions/utilities/dates';
import { AdminCardWrapper } from '@/components/admin/AdminCardWrapper';
import { alpha, useTheme } from '@mui/material/styles';

import HelpRoundedIcon from '@mui/icons-material/HelpRounded';

import { Box, Card, CardContent, Typography } from '@mui/material';

export const AdminDashboardFAQCard = () => {
  const { isPending, isError, error, data } = useQueryGetAllFAQ();
  const theme = useTheme();

  const mostRecent = data
    ?.slice()
    .sort((a, b) => new Date(String(b.updated)).getTime() - new Date(String(a.updated)).getTime())[0];

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <AdminCardWrapper isPending={isPending} isError={isError} error={error}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
            <Typography
              sx={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}
              color="text.secondary"
            >
              FAQ Items
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
              <HelpRoundedIcon sx={{ fontSize: 18 }} />
            </Box>
          </Box>

          <Typography variant="h4" fontWeight={700} lineHeight={1} mb={0.75}>
            {(data?.length ?? 0).toLocaleString()}
          </Typography>

          <Typography variant="caption" color="text.secondary">
            Last updated: {mostRecent?.updated ? createPrettyDate(mostRecent.updated as unknown as string) : '—'}
          </Typography>
        </AdminCardWrapper>
      </CardContent>
    </Card>
  );
};
