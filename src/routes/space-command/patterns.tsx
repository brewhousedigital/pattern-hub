import { createFileRoute } from '@tanstack/react-router';
import { AdminPatternTable } from '@/components/admin/AdminPatternTable';
import React from 'react';

export const Route = createFileRoute('/space-command/patterns')({
  component: RouteComponent,
});

function RouteComponent() {
  return <AdminPatternTable />;
}
