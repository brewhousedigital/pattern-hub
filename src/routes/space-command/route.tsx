import React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useGlobalAuthData, useRefreshAdminAuth } from '@/data/auth-data';
import { FullScreenLoader } from '@/components/layout/FullScreenLoader';
import { AdminLoginView } from '@/components/admin/AdminLoginView';
import { AdminLayout } from '@/components/layout/AdminLayout';

export const Route = createFileRoute('/space-command')({
  component: RouteComponent,
});

function RouteComponent() {
  const { isLoading, isAdmin, handleRefresh } = useRefreshAdminAuth();

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
      <Outlet />
    </AdminLayout>
  );
}
