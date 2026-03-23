import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useGlobalAuthData, useRefreshAdminAuth } from '@/data/auth-data';
import { FullScreenLoader } from '@/components/layout/FullScreenLoader';
import { AdminPatternTable } from '@/components/admin/AdminPatternTable';
import { AdminLoginView } from '@/components/admin/AdminLoginView';

import { Container } from '@mui/material';

export const Route = createFileRoute('/space-command/')({
  component: RouteComponent,
});

function RouteComponent() {
  const { isLoading } = useRefreshAdminAuth();

  const { authData } = useGlobalAuthData();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!authData) {
    return <AdminLoginView />;
  }

  return <AdminPageContent />;
}

const AdminPageContent = () => {
  return (
    <Container>
      <AdminPatternTable />
    </Container>
  );
};
