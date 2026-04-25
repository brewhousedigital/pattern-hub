import { useQueryGetAllPatternsByPaginationAdmin } from '@/functions/database/patterns';
import { AdminDashboardCardTitle } from '@/components/admin/AdminDashboardCardTitle';
import { createPrettyDate } from '@/functions/utilities/dates';
import { AdminCardWrapper } from '@/components/admin/AdminCardWrapper';

import { Card, CardContent, Typography } from '@mui/material';

export const AdminDashboardPatternsCard = () => {
  const { isPending, isError, error, data } = useQueryGetAllPatternsByPaginationAdmin('', 1);

  const firstItem = data?.items?.[0];

  return (
    <>
      <AdminDashboardCardTitle>Patterns</AdminDashboardCardTitle>

      <Card>
        <CardContent>
          <AdminCardWrapper isPending={isPending} isError={isError} error={error}>
            <Typography>Total Patterns: {data?.totalItems || 0}</Typography>
            <Typography>Newest Added: {createPrettyDate(firstItem?.created || '')}</Typography>
          </AdminCardWrapper>
        </CardContent>
      </Card>
    </>
  );
};
