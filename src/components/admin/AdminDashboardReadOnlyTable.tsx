import React from 'react';
import { useQueryGetAllTags } from '@/functions/database/tags';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';
import { AdminDashboardCardTitle } from '@/components/admin/AdminDashboardCardTitle';

import { DataGrid, type GridColDef } from '@mui/x-data-grid';

import { Alert, Box, Typography } from '@mui/material';

// Authors rows may carry a link to their custom /authors/$slug page
// (populated by AdminAuthorsTable from the manual_authors collection).
export type TypeAuthorsTableRow = TypeReadOnlyDatabaseItem & {
  manual_page_slug?: string;
  manual_page_published?: boolean;
};

type AdminDashboardReadOnlyTableProps = {
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  data: TypeAuthorsTableRow[];
  title: string;
  customProp?: 'authors';
};

export const AdminDashboardReadOnlyTable = (props: AdminDashboardReadOnlyTableProps) => {
  const columns: GridColDef<TypeAuthorsTableRow>[] = [
    { field: 'id', headerName: 'ID', width: 90, sortable: false, filterable: false },
    {
      field: 'tag',
      headerName: 'Tag',
      sortable: true,
      filterable: false,
      disableColumnMenu: true,
      flex: 1,
      renderCell: (params) => {
        if (props.customProp === 'authors') {
          if (params.row.user_id) {
            return (
              <a href={`/profile/${params.row.user_id}`} target="_blank">
                {params.value}
              </a>
            );
          }

          // Manual author with a published custom page - link to it
          if (params.row.manual_page_slug && params.row.manual_page_published) {
            return (
              <span>
                <a href={`/authors/${params.row.manual_page_slug}`} target="_blank">
                  {params.value}
                </a>{' '}
                (Manual)
              </span>
            );
          }

          // Page exists but isn't published yet - flag it instead of linking
          // to a route that would 404 publicly
          if (params.row.manual_page_slug) {
            return params.value + ' (Manual · draft page)';
          }

          return params.value + ' (Manual)';
        } else {
          return params.value;
        }
      },
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
