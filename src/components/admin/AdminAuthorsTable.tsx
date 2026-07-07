import React from 'react';
import { useQueryGetSpaceCommandDashboardData } from '@/functions/database/admin-dashboard-data';
import { AdminDashboardReadOnlyTable } from '@/components/admin/AdminDashboardReadOnlyTable';

export const AdminAuthorsTable = () => {
  const { isPending, isFetching, isError, data: dashboardData } = useQueryGetSpaceCommandDashboardData();
  const data = dashboardData?.authors;

  return (
    <AdminDashboardReadOnlyTable
      isPending={isPending}
      isFetching={isFetching}
      isError={isError}
      data={data || []}
      title="Authors"
      customProp="authors"
    />
  );
};
