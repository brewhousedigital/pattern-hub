import type { TypeComponentWithChildrenProps } from '@/functions/types/types';
import { Typography } from '@mui/material';

export const AdminDashboardCardTitle = (props: TypeComponentWithChildrenProps) => {
  return (
    <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>
      {props.children}
    </Typography>
  );
};
