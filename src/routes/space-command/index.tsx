import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useGlobalAuthData, useRefreshAdminAuth } from '@/data/auth-data';
import { FullScreenLoader } from '@/components/layout/FullScreenLoader';
import { AdminPatternTable } from '@/components/admin/AdminPatternTable';
import { AdminLoginView } from '@/components/admin/AdminLoginView';
import { AdminLayout } from '@/components/layout/AdminLayout';

import { Container } from '@mui/material';

export const Route = createFileRoute('/space-command/')({
  component: RouteComponent,
});

function RouteComponent() {
  const { isLoading, isAdmin, handleRefresh } = useRefreshAdminAuth();
  console.log('>>>isLoading', isLoading);

  React.useEffect(() => {
    handleRefresh().then();
  }, []);

  const { authData } = useGlobalAuthData();

  if (isLoading) {
    return <FullScreenLoader />;
  }

  if (!isAdmin) {
    return <AdminLoginView />;
  }

  if (!authData) {
    return <AdminLoginView />;
  }

  return (
    <AdminLayout>
      <AdminPageContent />
    </AdminLayout>
  );
}

const AdminPageContent = () => {
  return (
    <Container>
      <AdminPatternTable />
    </Container>
  );
};
