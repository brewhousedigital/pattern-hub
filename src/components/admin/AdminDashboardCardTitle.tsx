import type { TypeComponentWithChildrenProps } from '@/functions/types/types';
import { Typography } from '@mui/material';

export const AdminDashboardCardTitle = (props: TypeComponentWithChildrenProps) => {
  return (
    <Typography variant="h2" sx={{ fontSize: '32px!important', fontWeight: 600, mb: 2 }}>
      {props.children}
    </Typography>
  );
};
