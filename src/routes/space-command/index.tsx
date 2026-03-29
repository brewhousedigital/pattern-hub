import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { AdminTagsTable } from '@/components/admin/AdminTagsTable';
import { AdminAuthorsTable } from '@/components/admin/AdminAuthorsTable';

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
      <Grid size={{ xs: 12, md: 6 }}>
        <AdminTagsTable />
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <AdminAuthorsTable />
      </Grid>
    </Grid>
  );
}
