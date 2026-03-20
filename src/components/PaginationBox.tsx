import React from 'react';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import { Pagination, Stack } from '@mui/material';

type PaginationBoxProps = {
  data?: TypePaginationDatabaseResponse<any>;
  value: number;
  setter: (value: number) => void;
};

export const PaginationBox = (props: PaginationBoxProps) => {
  const handleChangePage = (event: React.ChangeEvent<unknown>, value: number) => {
    props.setter(value);
  };

  return (
    <Stack
      sx={{
        backgroundColor: '#fff',
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
        sx={{ mx: 'auto' }}
        page={props.value}
        onChange={handleChangePage}
      />
    </Stack>
  );
};
