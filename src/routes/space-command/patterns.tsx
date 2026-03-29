import { createFileRoute } from '@tanstack/react-router';
import { AdminPatternTable } from '@/components/admin/AdminPatternTable';
import React from 'react';
import { generateSEO } from '@/functions/utilities/seo.ts';

export const Route = createFileRoute('/space-command/patterns')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Patterns - Admin', '', match.pathname),
  }),
});

function RouteComponent() {
  return <AdminPatternTable />;
}
