import { createFileRoute } from '@tanstack/react-router';
import { AdminPatternTable } from '@/components/admin/AdminPatternTable';
import React from 'react';

export const Route = createFileRoute('/space-command/patterns')({
  component: RouteComponent,
  head: () => ({
    meta: [{ title: 'Patterns - Admin - Pattern Archive' }],
  }),
});

function RouteComponent() {
  return <AdminPatternTable />;
}
