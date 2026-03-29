import { useQueryUsersByPagination } from '@/functions/database/users.ts';
import { AdminDashboardCardTitle } from '@/components/admin/AdminDashboardCardTitle';
import { createPrettyDate } from '@/functions/utilities/dates';
import { AdminCardWrapper } from '@/components/admin/AdminCardWrapper';

import { Card, CardContent, Typography, CircularProgress } from '@mui/material';

export const AdminDashboardUsersCard = () => {
  const { isPending, isError, error, data } = useQueryUsersByPagination(1);

  const firstItem = data?.items?.[0];

  return (
    <>
      <AdminDashboardCardTitle>Users</AdminDashboardCardTitle>

      <Card>
        <CardContent>
          <AdminCardWrapper isPending={isPending} isError={isError} error={error}>
            <Typography>Total Users: {data?.totalItems || 0}</Typography>
            <Typography>Newest Registration: {createPrettyDate(firstItem?.created || '')}</Typography>
          </AdminCardWrapper>
        </CardContent>
      </Card>
    </>
  );
};
