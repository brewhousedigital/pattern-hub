import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo.ts';
import { useQueryAdminUsersByPagination } from '@/functions/database/users_admin';
import type { TypeAuthData } from '@/functions/database/authentication';
import LocalActivityRoundedIcon from '@mui/icons-material/LocalActivityRounded';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { PermissionsTransferList } from '@/components/admin/PermissionsTransferList';

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ListRoundedIcon from '@mui/icons-material/ListRounded';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { Box, Button, IconButton, Stack, Dialog, DialogContent, DialogTitle, DialogActions } from '@mui/material';

export const Route = createFileRoute('/space-command/admins')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Admins List - Admin', '', match.pathname),
  }),
});

function RouteComponent() {
  const [pageNumber, setPageNumber] = React.useState({
    page: 1,
    pageSize: 25,
  });

  const { isPending, isFetching, isError, data } = useQueryAdminUsersByPagination(pageNumber.page);

  const columns: GridColDef<TypeAuthData>[] = [
    { field: 'id', headerName: 'ID', flex: 1, sortable: false, filterable: false, disableColumnMenu: true },
    {
      field: 'email',
      headerName: 'email',
      sortable: false,
      flex: 1,
      filterable: false,
      disableColumnMenu: true,
    },
    {
      field: 'name',
      headerName: 'Name',
      sortable: false,
      flex: 1,
      filterable: false,
      disableColumnMenu: true,
    },
    {
      field: 'isSuperAdmin',
      headerName: 'Super?',
      sortable: false,
      flex: 1,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => {
        if (params?.row?.level?.includes(EnumLevelsAdmin.ADMINS_AR)) {
          return <LocalActivityRoundedIcon color="primary" />;
        }
        return;
      },
    },
    {
      field: 'actions',
      type: 'actions',
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      headerName: 'Actions',
      flex: 2,
      cellClassName: 'actions',
      renderCell: (params) => {
        return (
          <Stack direction="row" spacing={2}>
            <EditPermissionsModal data={params.row} />
            <Button startIcon={<CloseRoundedIcon />} color="error">
              Block
            </Button>
          </Stack>
        );
      },
    },
  ];

  return (
    <Box sx={{ height: 400, width: '100%' }}>
      <DataGrid
        autosizeOnMount
        loading={isPending || isFetching}
        rows={data?.items || []}
        columns={columns}
        initialState={{
          pagination: {
            paginationModel: {
              pageSize: 25,
            },
          },
        }}
        pageSizeOptions={[25]}
        checkboxSelection={false}
        disableRowSelectionOnClick
        pagination
        rowCount={data?.totalItems || 0}
        sortingMode="server"
        filterMode="server"
        paginationMode="server"
        onPaginationModelChange={(newPaginationModel) => {
          // fetch data from server
          setPageNumber({
            ...newPaginationModel,
            // Pocketbase starts at page 1, not 0, so we have to manually increment
            page: newPaginationModel.page + 1,
          });
        }}
      />
    </Box>
  );
}

type EditPermissionsModalProps = {
  data: TypeAuthData;
};

const EditPermissionsModal = (props: EditPermissionsModalProps) => {
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <>
      <Button startIcon={<ListRoundedIcon />} onClick={handleClickOpen}>
        Permissions
      </Button>

      <Dialog open={open} maxWidth="md" fullWidth onClose={handleClose} aria-labelledby="permissions-dialog-title">
        <DialogTitle id="permissions-dialog-title">Editing: {props.data.name}</DialogTitle>

        <DialogContent>
          <PermissionsTransferList userData={props.data} />
        </DialogContent>
      </Dialog>
    </>
  );
};
