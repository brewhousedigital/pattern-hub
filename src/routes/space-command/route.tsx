import React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { useGlobalAuthData, useRefreshAdminAuth } from '@/data/auth-data';
import { FullScreenLoader } from '@/components/layout/FullScreenLoader';
import { AdminLoginView } from '@/components/admin/AdminLoginView';
import { AdminLayout } from '@/components/layout/AdminLayout';

export const Route = createFileRoute('/space-command')({
  component: RouteComponent,
  // Admin panel is auth-gated via localStorage tokens - no value in rendering it on the server
  ssr: false,
});

function RouteComponent() {
  const [isAuthLoading, setIsAuthLoading] = React.useState(true);

  const { isLoading, isAdmin, handleRefresh } = useRefreshAdminAuth();

  React.useEffect(() => {
    handleRefresh().then(() => setIsAuthLoading(false));
  }, []);

  const { authData } = useGlobalAuthData();

  if (isLoading || isAuthLoading) {
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
