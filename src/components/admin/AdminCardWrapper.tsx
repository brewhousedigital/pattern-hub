import React from 'react';
import { Alert, CircularProgress } from '@mui/material';

type AdminCardWrapperProps = {
  children: React.ReactNode;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

export const AdminCardWrapper = (props: AdminCardWrapperProps) => {
  if (props?.isPending) {
    return <CircularProgress />;
  }

  if (props?.isError) {
    return <Alert severity="error">Error: {props?.error?.message}</Alert>;
  }

  return props.children;
};
