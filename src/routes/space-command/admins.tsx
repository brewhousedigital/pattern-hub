import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo.ts';
import {
  useMutationCreateAdminUser,
  useMutationResetAdminUser,
  useQueryAdminUsersByPagination,
  useMutationDeleteAdminUser,
} from '@/functions/database/users_admin';
import type { TypeAuthData } from '@/functions/database/authentication';
import LocalActivityRoundedIcon from '@mui/icons-material/LocalActivityRounded';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { PermissionsTransferList } from '@/components/admin/PermissionsTransferList';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer.tsx';

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ListRoundedIcon from '@mui/icons-material/ListRounded';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { Box, Button, Stack, Dialog, DialogContent, DialogTitle, TextField } from '@mui/material';
import { enqueueSnackbar } from 'notistack';

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
            <DeleteAdminModel data={params.row} />
          </Stack>
        );
      },
    },
  ];

  return (
    <Box>
      <AdminHeaderContainer
        title="Admin Management"
        subtitle="With great power comes great responsibility"
        actionNode={<AddAdminModel />}
      />

      <Box sx={{ height: 'calc(100svh - 200px)', width: '100%' }}>
        <DataGrid
          autosizeOnMount
          loading={isPending || isFetching}
          rows={data?.items || []}
          columns={columns}
          initialState={{
            pagination: {
              paginationModel: {
                pageSize: 100,
              },
            },
          }}
          pageSizeOptions={[100]}
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
          <PermissionsTransferList userData={props.data} handleCloseModal={handleClose} />
        </DialogContent>
      </Dialog>
    </>
  );
};

const AddAdminModel = () => {
  const { refetch } = useQueryAdminUsersByPagination(1);

  const registerNewUser = useMutationCreateAdminUser();
  const resetAdminPassword = useMutationResetAdminUser();

  const [open, setOpen] = React.useState(false);

  const [isLoading, setIsLoading] = React.useState(false);

  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();

    try {
      const tempPassword = crypto.randomUUID();

      await registerNewUser.mutateAsync({
        name: name,
        email: email,
        emailVisibility: true,
        password: tempPassword,
        passwordConfirm: tempPassword,
        level: [],
      });

      await resetAdminPassword.mutateAsync(email);

      await refetch();

      handleClose();

      enqueueSnackbar(
        `Created new admin for: '${email}'. They'll receive an email to reset their password and set up their account.`,
        { variant: 'success' },
      );

      setTimeout(() => {
        setName('');
        setEmail('');
      }, 1000);
    } catch (error: any) {
      enqueueSnackbar(`Error creating admin: ${error.message}`, { variant: 'error' });
    }
  };

  return (
    <>
      <Button startIcon={<AddRoundedIcon />} variant="contained" onClick={handleClickOpen}>
        Create Admin
      </Button>

      <Dialog open={open} maxWidth="sm" fullWidth onClose={handleClose} aria-labelledby="add-dialog-title">
        <DialogTitle id="add-dialog-title">Create a new Admin</DialogTitle>

        <DialogContent>
          <Stack spacing={2} component="form" onSubmit={handleSubmit}>
            <TextField variant="filled" label="Unique Name" value={name} onChange={(e) => setName(e.target.value)} />

            <TextField
              variant="filled"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <Button loading={isLoading} type="submit">
              Save
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
};

const DeleteAdminModel = (props: EditPermissionsModalProps) => {
  const { refetch } = useQueryAdminUsersByPagination(1);

  const deleteAdmin = useMutationDeleteAdminUser();

  const [open, setOpen] = React.useState(false);

  const [isLoading, setIsLoading] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleDelete = async () => {
    setIsLoading(true);

    try {
      await deleteAdmin.mutateAsync(props.data.id);

      await refetch();

      handleClose();

      enqueueSnackbar(`Deleted '${props.data.name}'. They will no longer be able to log in.`, { variant: 'success' });
    } catch (error: any) {
      enqueueSnackbar(
        `Error deleting admin: '${error.message}'. Probably not good. Try again in a minute or two or contact Axin.`,
        { variant: 'error' },
      );
    }

    setIsLoading(false);
  };

  return (
    <>
      <Button startIcon={<CloseRoundedIcon />} color="error" onClick={handleClickOpen}>
        Delete
      </Button>

      <Dialog open={open} maxWidth="sm" fullWidth onClose={handleClose} aria-labelledby="delete-dialog-title">
        <DialogTitle id="delete-dialog-title">Delete {props.data.name}?</DialogTitle>

        <DialogContent>
          <Stack spacing={2} component="form">
            <Button loading={isLoading} type="submit" variant="contained" color="error" onClick={handleDelete}>
              Are you sure you want to delete them?
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
};
