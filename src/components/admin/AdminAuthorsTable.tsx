import React from 'react';
import { useQueryGetAllManualAuthors } from '@/functions/database/authors';
import { AdminDashboardReadOnlyTable } from '@/components/admin/AdminDashboardReadOnlyTable';

export const AdminAuthorsTable = () => {
  const { isPending, isFetching, isError, data } = useQueryGetAllManualAuthors();

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
