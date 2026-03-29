import React from 'react';
import { useQueryGetAllTags } from '@/functions/database/tags';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';
import { AdminDashboardCardTitle } from '@/components/admin/AdminDashboardCardTitle';

import { DataGrid, type GridColDef } from '@mui/x-data-grid';

import { Alert, Box, Typography } from '@mui/material';

type AdminDashboardReadOnlyTableProps = {
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  data: TypeReadOnlyDatabaseItem[];
  title: string;
};

export const AdminDashboardReadOnlyTable = (props: AdminDashboardReadOnlyTableProps) => {
  const columns: GridColDef<TypeReadOnlyDatabaseItem>[] = [
    { field: 'id', headerName: 'ID', width: 90, sortable: false, filterable: false },
    {
      field: 'tag',
      headerName: 'Tag',
      sortable: true,
      filterable: false,
      disableColumnMenu: true,
      flex: 1,
    },
    {
      field: 'count',
      headerName: 'Count',
      sortable: true,
      filterable: false,
      disableColumnMenu: true,
      flex: 1,
    },
  ];

  if (props.isError) {
    return <Alert severity="error">Something went wrong loading this table. Try again in a few minutes</Alert>;
  }

  return (
    <>
      <AdminDashboardCardTitle>{props.title}</AdminDashboardCardTitle>

      <Box sx={{ height: 500, width: '100%' }}>
        <DataGrid
          loading={props.isPending || props.isFetching}
          rows={props.data ?? []}
          columns={columns}
          showToolbar
          pageSizeOptions={[50]}
          checkboxSelection={false}
          disableRowSelectionOnClick
          initialState={{
            pagination: {
              paginationModel: {
                pageSize: 50,
              },
            },
            columns: {
              columnVisibilityModel: {
                id: false,
              },
            },
            sorting: {
              sortModel: [{ field: 'count', sort: 'desc' }],
            },
          }}
        />
      </Box>
    </>
  );
};
