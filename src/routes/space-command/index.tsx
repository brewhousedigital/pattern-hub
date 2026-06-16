import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AdminAuthorsTable } from '@/components/admin/AdminAuthorsTable';
import { AdminDashboardUsersCard } from '@/components/admin/AdminDashboardUsersCard';
import { AdminDashboardComplaintsCard } from '@/components/admin/AdminDashboardComplaintsCard';
import { AdminDashboardPatternsCard } from '@/components/admin/AdminDashboardPatternsCard';
import { AdminDashboardFAQCard } from '@/components/admin/AdminDashboardFAQCard';
import { AdminDashboardWikiCard } from '@/components/admin/AdminDashboardWikiCard';
import { AdminDashboardMapCard } from '@/components/admin/AdminDashboardMapCard';
import { AdminDashboardTagsCard } from '@/components/admin/AdminDashboardTagsCard';
import { AdminDashboardSetsCard } from '@/components/admin/AdminDashboardSetsCard';

import { Box, Divider, Grid, Typography } from '@mui/material';
import { generateSEO } from '@/functions/utilities/seo.ts';

export const Route = createFileRoute('/space-command/')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Admin', '', match.pathname),
  }),
});

function RouteComponent() {
  return (
    <Box>
      {/* Page header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Overview of Pattern Archive activity
        </Typography>
      </Box>

      {/* Platform stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AdminDashboardUsersCard />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AdminDashboardPatternsCard />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AdminDashboardTagsCard />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AdminDashboardComplaintsCard />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AdminDashboardFAQCard />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AdminDashboardWikiCard />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AdminDashboardMapCard />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <AdminDashboardSetsCard />
        </Grid>
      </Grid>

      <Divider sx={{ mb: 3 }} />

      {/* Data tables */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 12 }}>
          <AdminAuthorsTable />
        </Grid>
      </Grid>
    </Box>
  );
}
