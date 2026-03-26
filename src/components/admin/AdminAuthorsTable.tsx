import React from 'react';
import { useQueryGetAllAuthors } from '@/functions/database/authors';
import { AdminDashboardReadOnlyTable } from '@/components/admin/AdminDashboardReadOnlyTable';

export const AdminAuthorsTable = () => {
  const { isPending, isFetching, isError, data } = useQueryGetAllAuthors();

  return (
    <AdminDashboardReadOnlyTable
      isPending={isPending}
      isFetching={isFetching}
      isError={isError}
      data={data || []}
      title="Authors"
    />
  );
};
