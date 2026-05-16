import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { createPrettyDate } from '@/functions/utilities/dates';
import {
  useQueryGetReviewedComplaintsByPagination,
  type TypeComplaintsResponse,
} from '@/functions/database/complaints.ts';
import { AdminComplaintsModal } from '@/components/admin/AdminComplaintsModal.tsx';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer.tsx';
import { useGlobalAdminFilterComplaints, useGlobalAdminPaginationComplaints } from '@/data/admin-global-state';
import { useDebounce } from '@/functions/hooks/useDebounce';

import { Box, Button, Typography } from '@mui/material';

import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { enqueueSnackbar } from 'notistack';
import { generateSEO } from '@/functions/utilities/seo.ts';

export const Route = createFileRoute('/space-command/complaints/reviewed')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Reviewed Reports - Admin', '', match.pathname),
  }),
});

function RouteComponent() {
  const [rows, setRows] = React.useState<TypeComplaintsResponse[]>([]);
  const [totalRows, setTotalRows] = React.useState(0);

  const { paginationModel, setPaginationModel } = useGlobalAdminPaginationComplaints();

  const { setFilterModel, searchResult } = useGlobalAdminFilterComplaints();
  const debouncedSearchTerm = useDebounce(searchResult, 600);

  const { isPending, isFetching, isError, data, refetch } = useQueryGetReviewedComplaintsByPagination(
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

  const columns: GridColDef<TypeComplaintsResponse>[] = [
    { field: 'id', headerName: 'ID', width: 90, sortable: false, filterable: false },
    {
      field: 'pattern',
      headerName: 'Image',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      width: 85,
      renderCell: (params) => {
        const pattern = params.row.expand?.pattern_id;
        const thumbUrl = generatePbImage(pattern);

        return (
          <img
            src={thumbUrl}
            alt="pattern"
            style={{
              width: 75,
              height: 75,
              aspectRatio: '1/1',
            }}
          />
        );
      },
    },
    {
      field: 'patternName',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerName: 'Pattern Name',
      width: 200,
      renderCell: (params) => {
        const pattern = params.row.expand?.pattern_id;
        return (
          <>
            <a href={`/pattern/${pattern?.id}`} target="_blank">
              <Typography sx={{ fontWeight: 500 }}>{pattern?.name}</Typography>
            </a>
            <Typography variant="body2">{pattern?.id}</Typography>
          </>
        );
      },
    },
    { field: 'category', disableColumnMenu: true, headerName: 'Category', flex: 1, sortable: false, filterable: false },
    { field: 'reason', disableColumnMenu: true, headerName: 'Reason', flex: 1, sortable: false, filterable: false },
    {
      field: 'email',
      headerName: 'Email',
      disableColumnMenu: true,
      width: 200,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const user = params.row.expand?.owner_id;
        return (
          <>
            <Typography sx={{ fontWeight: 500 }}>{params.value}</Typography>
            <Typography variant="body2">User: {user?.id ? user?.id : 'No Auth'}</Typography>
          </>
        );
      },
    },
    {
      field: 'reviewedBy',
      headerName: 'Reviewed By',
      disableColumnMenu: true,
      width: 200,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const admin = params.row.expand?.reviewed_by;
        return admin?.name;
      },
    },
    {
      field: 'created',
      headerName: 'Created',
      disableColumnMenu: true,
      width: 120,
      sortable: false,
      filterable: false,
      valueFormatter: (value?: string) => {
        if (value == null) {
          return '';
        }
        return createPrettyDate(value || '');
      },
    },
    {
      field: 'updated',
      headerName: 'Updated',
      disableColumnMenu: true,
      width: 120,
      sortable: false,
      filterable: false,
      valueFormatter: (value?: string) => {
        if (value == null) {
          return '';
        }
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
          Review
        </Button>
      ),
    },
  ];

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<TypeComplaintsResponse | null>(null);

  function openReview(complaint: TypeComplaintsResponse) {
    setSelected(complaint);
    setDialogOpen(true);
  }

  const handleModalClose = async () => {
    try {
      setDialogOpen(false);
      await refetch();
    } catch (error) {
      enqueueSnackbar('Something went wrong updating this complaint... Try again in a few minutes', {
        variant: 'error',
      });
    }
  };

  return (
    <Box>
      <AdminHeaderContainer title="Reviewed Reports" />

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
          // fetch data from server
          setPaginationModel({
            ...newPaginationModel,
            // Pocktbase starts at page 1, not 0, so we have to manually increment
            page: newPaginationModel.page + 1,
          });
        }}
        onFilterModelChange={(newFilterModel) => {
          // fetch data from server
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

      <AdminComplaintsModal
        open={dialogOpen}
        onClose={handleModalClose}
        complaint={selected}
        key={selected?.id || ''}
      />
    </Box>
  );
}
