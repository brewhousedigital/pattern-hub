import React from 'react';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import { Pagination, Stack } from '@mui/material';

type PaginationBoxProps = {
  data?: TypePaginationDatabaseResponse<any>;
  value: number;
  setter: (value: number) => void;
  isDark?: boolean;
};

export const PaginationBox = (props: PaginationBoxProps) => {
  const handleChangePage = (event: React.ChangeEvent<unknown>, value: number) => {
    props.setter(value);
  };

  return (
    <Stack
      sx={{
        backgroundColor: props.isDark ? '#242424' : '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 2,
        mt: 'auto',
        borderRadius: 6,
      }}
    >
      <Pagination
        count={props.data?.totalPages || 0}
        variant="outlined"
        color="primary"
        sx={{
          mx: 'auto',
          ...(props.isDark ? {
            '& .MuiPaginationItem-root': {
              color: 'rgba(255,255,255,0.75)',
              borderColor: 'rgba(255,255,255,0.15)',
            },
            '& .MuiPaginationItem-root.Mui-selected': {
              color: 'white',
              borderColor: 'primary.main',
            },
            '& .MuiPaginationItem-root.Mui-disabled': {
              color: 'rgba(255,255,255,0.25)',
            },
          } : {}),
        }}
        page={props.value}
        onChange={handleChangePage}
      />
    </Stack>
  );
};
