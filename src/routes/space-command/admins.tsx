import React, { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo';
import {
  useMutationCreateAdminUser,
  useMutationResetAdminUser,
  useQueryAdminUsersByPagination,
  useMutationDeleteAdminUser,
} from '@/functions/database/users_admin';
import type { TypeAuthData } from '@/functions/database/authentication';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { PermissionsTransferList } from '@/components/admin/PermissionsTransferList';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { enqueueSnackbar } from 'notistack';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { DataGrid } from '@mui/x-data-grid';

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import LockResetIcon from '@mui/icons-material/LockReset';
import DeleteIcon from '@mui/icons-material/Delete';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';

import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/space-command/admins')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Admins - Admin', '', match.pathname),
  }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initialsOf(name = ''): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { checkAccess } = useCheckAdminAccess();
  const canCreate = checkAccess(EnumLevelsAdmin.ADMINS_AC);
  const canEdit = checkAccess(EnumLevelsAdmin.ADMINS_AU);
  const canDelete = checkAccess(EnumLevelsAdmin.ADMINS_AD);

  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 100 });

  const { isPending, isFetching, isError, data, refetch } = useQueryAdminUsersByPagination(paginationModel.page + 1);

  // ── Reset password ─────────────────────────────────────────────────────────
  const resetPassword = useMutationResetAdminUser();

  async function handleResetPassword(admin: TypeAuthData) {
    if (!admin.email) return;
    try {
      await resetPassword.mutateAsync(admin.email);
      enqueueSnackbar(`Password reset email sent to ${admin.email}.`, { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to send reset email. Try again.', { variant: 'error' });
    }
  }

  // ── Delete dialog ──────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<TypeAuthData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteAdminMut = useMutationDeleteAdminUser();

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAdminMut.mutateAsync(deleteTarget.id);
      enqueueSnackbar(`Admin "${deleteTarget.name || deleteTarget.email}" removed.`, { variant: 'success' });
      setDeleteTarget(null);
      void refetch();
    } catch {
      enqueueSnackbar('Failed to remove admin. Try again.', { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  }

  // ── Permissions dialog ─────────────────────────────────────────────────────
  const [permTarget, setPermTarget] = useState<TypeAuthData | null>(null);

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: GridColDef<TypeAuthData>[] = [
    {
      field: 'name',
      headerName: 'Admin',
      flex: 1.5,
      minWidth: 200,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeAuthData>) => (
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Avatar
            sx={{
              width: 30,
              height: 30,
              fontSize: '0.7rem',
              bgcolor: 'secondary.main',
              flexShrink: 0,
            }}
          >
            {initialsOf(params.row.name)}
          </Avatar>
          <Box>
            <Typography fontSize={13} fontWeight={600} lineHeight={1.3}>
              {params.row.name || <em style={{ opacity: 0.5 }}>No name</em>}
            </Typography>
            <Typography fontSize={11} color="text.disabled" fontFamily="monospace">
              {params.row.id}
            </Typography>
          </Box>
        </Stack>
      ),
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1.5,
      minWidth: 200,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeAuthData>) => (
        <Typography fontSize={13} color="text.secondary">
          {params.row.email || '—'}
        </Typography>
      ),
    },
    {
      field: 'level',
      headerName: 'Role',
      width: 160,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeAuthData>) => {
        const isSuperAdmin = params.row.level?.includes(EnumLevelsAdmin.ADMINS_AR);
        const permCount = params.row.level?.length ?? 0;
        return isSuperAdmin ? (
          <Chip
            icon={<AdminPanelSettingsRoundedIcon sx={{ fontSize: '13px !important' }} />}
            label="Super Admin"
            size="small"
            color="error"
            variant="outlined"
            sx={{ fontSize: '0.68rem', height: 22 }}
          />
        ) : (
          <Chip
            label={`${permCount} permission${permCount !== 1 ? 's' : ''}`}
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.68rem', height: 22 }}
          />
        );
      },
    },
    {
      field: 'created',
      headerName: 'Joined',
      width: 130,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeAuthData>) => (
        <Typography fontSize={12} color="text.secondary">
          {formatDate(params.row.created)}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 120,
      sortable: false,
      disableColumnMenu: true,
      align: 'center',
      renderCell: (params: GridRenderCellParams<TypeAuthData>) => (
        <Stack direction="row" spacing={0.25} justifyContent="center">
          <Tooltip title={canEdit ? 'Edit permissions' : 'Requires ADMINS_AU permission'}>
            <span>
              <IconButton size="small" disabled={!canEdit} onClick={() => setPermTarget(params.row)}>
                <ManageAccountsRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="Send password reset email">
            <span>
              <IconButton
                size="small"
                disabled={resetPassword.isPending}
                onClick={() => handleResetPassword(params.row)}
              >
                <LockResetIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={canDelete ? 'Remove admin' : 'Requires ADMINS_AD permission'}>
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={!canDelete || deleting}
                onClick={() => setDeleteTarget(params.row)}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <AdminHeaderContainer
        title="Admin Management"
        subtitle={
          <Typography variant="body2" color="text.secondary">
            {(data?.totalItems ?? 0).toLocaleString()} admin{(data?.totalItems ?? 1) !== 1 ? 's' : ''}
          </Typography>
        }
        actionNode={canCreate ? <AddAdminDialog onCreated={() => void refetch()} /> : undefined}
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load admins. Please refresh and try again.
        </Alert>
      )}

      <DataGrid
        columns={columns}
        rows={data?.items ?? []}
        rowCount={data?.totalItems ?? 0}
        loading={isPending || isFetching}
        pagination
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={(m) => setPaginationModel(m)}
        pageSizeOptions={[25, 50, 100]}
        sortingMode="server"
        showToolbar
        disableRowSelectionOnClick
        getRowHeight={() => 'auto'}
        sx={{
          '& .MuiDataGrid-cell': { alignItems: 'center', py: 0.75 },
        }}
        initialState={{
          columns: { columnVisibilityModel: { id: false } },
        }}
      />

      {/* Edit permissions dialog */}
      <Dialog open={!!permTarget} onClose={() => setPermTarget(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit permissions — {permTarget?.name || permTarget?.email}</DialogTitle>
        <Divider />
        <DialogContent>
          {permTarget && (
            <PermissionsTransferList
              userData={permTarget}
              handleCloseModal={() => {
                setPermTarget(null);
                void refetch();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Remove Admin</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          <DialogContentText>
            Remove admin access for <strong>{deleteTarget?.name || deleteTarget?.email || 'this admin'}</strong>?
            {deleteTarget?.email && (
              <>
                {' '}
                <Typography component="span" variant="body2" color="text.disabled">
                  ({deleteTarget.email})
                </Typography>
              </>
            )}
          </DialogContentText>
          <DialogContentText sx={{ mt: 1.5, color: 'error.main', fontSize: 13 }}>
            They will immediately lose all admin panel access.
          </DialogContentText>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} variant="outlined" disabled={deleting} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            onClick={confirmDelete}
            variant="contained"
            color="error"
            loading={deleting}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            Remove Admin
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ─── AddAdminDialog ───────────────────────────────────────────────────────────

type AddAdminDialogProps = {
  onCreated: () => void;
};

function AddAdminDialog({ onCreated }: AddAdminDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const createAdmin = useMutationCreateAdminUser();
  const resetPassword = useMutationResetAdminUser();

  useEffect(() => {
    if (!open) {
      setName('');
      setEmail('');
      setSaving(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    try {
      const tempPassword = crypto.randomUUID();
      await createAdmin.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        emailVisibility: true,
        password: tempPassword,
        passwordConfirm: tempPassword,
        level: [],
      });
      await resetPassword.mutateAsync(email.trim());
      enqueueSnackbar(`Admin created for ${email}. They'll receive an email to set up their password.`, {
        variant: 'success',
      });
      onCreated();
      setOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      enqueueSnackbar(`Failed to create admin: ${msg}`, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="contained" color="success" startIcon={<AddRoundedIcon />} onClick={() => setOpen(true)}>
        Add Admin
      </Button>

      <Dialog open={open} onClose={() => !saving && setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add Admin</DialogTitle>
        <Divider />
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2.5 }}>
            <TextField
              label="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              variant="filled"
              autoFocus
            />
            <TextField
              label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              variant="filled"
              type="email"
              helperText="A password setup email will be sent automatically."
            />
          </DialogContent>
          <Divider />
          <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
            <Button onClick={() => setOpen(false)} variant="outlined" disabled={saving} sx={{ borderRadius: 2 }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              loading={saving}
              disabled={!name.trim() || !email.trim()}
              sx={{ borderRadius: 2, fontWeight: 700 }}
            >
              Create Admin
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
