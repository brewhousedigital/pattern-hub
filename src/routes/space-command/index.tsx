import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AdminTagsTable } from '@/components/admin/AdminTagsTable';
import { AdminAuthorsTable } from '@/components/admin/AdminAuthorsTable';
import { AdminDashboardUsersCard } from '@/components/admin/AdminDashboardUsersCard';
import { AdminDashboardComplaintsCard } from '@/components/admin/AdminDashboardComplaintsCard';
import { AdminDashboardPatternsCard } from '@/components/admin/AdminDashboardPatternsCard';

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
        <Typography variant="h5" fontWeight={700} lineHeight={1.2}>
          Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          Overview of Pattern Archive activity
        </Typography>
      </Box>

      {/* Stat cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <AdminDashboardUsersCard />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <AdminDashboardPatternsCard />
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <AdminDashboardComplaintsCard />
        </Grid>
      </Grid>

      <Divider sx={{ mb: 3 }} />

      {/* Data tables */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <AdminTagsTable />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <AdminAuthorsTable />
        </Grid>
      </Grid>
    </Box>
  );
}
