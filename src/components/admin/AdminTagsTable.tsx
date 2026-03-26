import React from 'react';
import { useQueryGetAllTags } from '@/functions/database/tags';
import { AdminDashboardReadOnlyTable } from '@/components/admin/AdminDashboardReadOnlyTable';

export const AdminTagsTable = () => {
  const { isPending, isFetching, isError, data } = useQueryGetAllTags();

  return (
    <AdminDashboardReadOnlyTable
      isPending={isPending}
      isFetching={isFetching}
      isError={isError}
      data={data || []}
      title="Tags"
    />
  );
};
