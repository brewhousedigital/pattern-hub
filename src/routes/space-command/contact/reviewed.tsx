import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { createPrettyDate } from '@/functions/utilities/dates';
import {
  useQueryGetReviewedContactSubmissionsByPagination,
  type TypeContactResponse,
} from '@/functions/database/contact';
import { AdminContactModal } from '@/components/admin/AdminContactModal';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { useGlobalAdminFilterContact, useGlobalAdminPaginationContact } from '@/data/admin-global-state';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { generateSEO } from '@/functions/utilities/seo';

import { Box, Button, Typography } from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { enqueueSnackbar } from 'notistack';

export const Route = createFileRoute('/space-command/contact/reviewed')({
  component: RouteComponent,
  head: ({ match }) => generateSEO('Reviewed Submissions - Admin', '', match.pathname),
});

function RouteComponent() {
  const [rows, setRows] = React.useState<TypeContactResponse[]>([]);
  const [totalRows, setTotalRows] = React.useState(0);

  const { paginationModel, setPaginationModel } = useGlobalAdminPaginationContact();

  const { setFilterModel, searchResult } = useGlobalAdminFilterContact();
  const debouncedSearchTerm = useDebounce(searchResult, 600);

  const { isPending, isFetching, data, refetch } = useQueryGetReviewedContactSubmissionsByPagination(
    debouncedSearchTerm,
    paginationModel.page,
  );

  React.useEffect(() => {
    if (data) {
      setRows(data.items);
      setTotalRows(data.totalItems);
    } else {
      setRows([]);
    }
  }, [data]);

  const columns: GridColDef<TypeContactResponse>[] = [
    { field: 'id', headerName: 'ID', width: 90, sortable: false, filterable: false },
    {
      field: 'name',
      headerName: 'Name',
      disableColumnMenu: true,
      width: 160,
      sortable: false,
      filterable: false,
    },
    {
      field: 'email',
      headerName: 'Email',
      disableColumnMenu: true,
      width: 220,
      sortable: false,
      filterable: false,
    },
    {
      field: 'message',
      headerName: 'Message',
      disableColumnMenu: true,
      flex: 1,
      sortable: false,
      filterable: false,
    },
    {
      field: 'review_notes',
      headerName: 'Review Notes',
      disableColumnMenu: true,
      width: 200,
      sortable: false,
      filterable: false,
    },
    {
      field: 'reviewedBy',
      headerName: 'Reviewed By',
      disableColumnMenu: true,
      width: 160,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const admin = params.row.expand?.reviewed_by;
        return admin?.name ?? '-';
      },
    },
    {
      field: 'created',
      headerName: 'Submitted',
      disableColumnMenu: true,
      width: 120,
      sortable: false,
      filterable: false,
      valueFormatter: (value?: string) => {
        if (value == null) return '';
        return createPrettyDate(value || '');
      },
    },
    {
      field: 'updated',
      headerName: 'Reviewed',
      disableColumnMenu: true,
      width: 120,
      sortable: false,
      filterable: false,
      valueFormatter: (value?: string) => {
        if (value == null) return '';
        return createPrettyDate(value || '');
      },
    },
    {
      field: 'actions',
      type: 'actions',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerName: 'Actions',
      width: 100,
      cellClassName: 'actions',
      renderCell: (params) => (
        <Button size="small" variant="contained" color="success" onClick={() => openReview(params.row)}>
          View
        </Button>
      ),
    },
  ];

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<TypeContactResponse | null>(null);

  function openReview(submission: TypeContactResponse) {
    setSelected(submission);
    setDialogOpen(true);
  }

  const handleModalClose = async () => {
    try {
      setDialogOpen(false);
      await refetch();
    } catch {
      enqueueSnackbar('Something went wrong updating this submission… Try again in a few minutes', {
        variant: 'error',
      });
    }
  };

  return (
    <Box>
      <AdminHeaderContainer title="Reviewed Submissions" />

      <DataGrid
        columns={columns}
        loading={isPending || isFetching}
        rows={rows ?? []}
        showToolbar
        pageSizeOptions={[25]}
        checkboxSelection={false}
        disableRowSelectionOnClick
        pagination
        rowCount={totalRows}
        sortingMode="server"
        filterMode="server"
        paginationMode="server"
        onPaginationModelChange={(newPaginationModel) => {
          setPaginationModel({
            ...newPaginationModel,
            // PocketBase starts at page 1, not 0
            page: newPaginationModel.page + 1,
          });
        }}
        onFilterModelChange={(newFilterModel) => {
          setFilterModel(newFilterModel);
        }}
        initialState={{
          pagination: {
            paginationModel: {
              pageSize: 25,
            },
          },
          columns: {
            columnVisibilityModel: {
              id: false,
            },
          },
        }}
      />

      <AdminContactModal open={dialogOpen} onClose={handleModalClose} submission={selected} key={selected?.id || ''} />
    </Box>
  );
}
