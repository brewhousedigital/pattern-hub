import { useQueryGetComplaints } from '@/functions/database/complaints';
import { AdminDashboardCardTitle } from '@/components/admin/AdminDashboardCardTitle';
import { createPrettyDate } from '@/functions/utilities/dates';
import { AdminCardWrapper } from '@/components/admin/AdminCardWrapper';

import { Card, CardContent, Typography } from '@mui/material';

export const AdminDashboardComplaintsCard = () => {
  const { isPending, isError, error, data } = useQueryGetComplaints();
  const total = data?.length || 0;

  const firstItem = data?.[0];

  return (
    <>
      <AdminDashboardCardTitle>Reports</AdminDashboardCardTitle>

      <Card>
        <CardContent>
          <AdminCardWrapper isPending={isPending} isError={isError} error={error}>
            <Typography>Active Reports: {total}</Typography>
            <Typography>
              Latest Report: {firstItem?.created ? createPrettyDate(firstItem?.created || '') : 'None'}
            </Typography>
          </AdminCardWrapper>
        </CardContent>
      </Card>
    </>
  );
};
