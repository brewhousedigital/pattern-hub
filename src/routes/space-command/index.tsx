import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AdminTagsTable } from '@/components/admin/AdminTagsTable';
import { AdminAuthorsTable } from '@/components/admin/AdminAuthorsTable';
import { AdminDashboardUsersCard } from '@/components/admin/AdminDashboardUsersCard';
import { AdminDashboardComplaintsCard } from '@/components/admin/AdminDashboardComplaintsCard';
import { AdminDashboardPatternsCard } from '@/components/admin/AdminDashboardPatternsCard';

import { Grid } from '@mui/material';
import { generateSEO } from '@/functions/utilities/seo.ts';

export const Route = createFileRoute('/space-command/')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Admin', '', match.pathname),
  }),
});

function RouteComponent() {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}>
        <AdminDashboardUsersCard />
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <AdminDashboardPatternsCard />
      </Grid>

      <Grid size={{ xs: 12, md: 4 }}>
        <AdminDashboardComplaintsCard />
      </Grid>

      <Grid size={{ xs: 12 }}></Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <AdminTagsTable />
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <AdminAuthorsTable />
      </Grid>
    </Grid>
  );
}
