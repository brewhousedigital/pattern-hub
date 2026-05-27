import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useQueryAdminUsersPaginated,
  useMutationResetUserPassword,
  useMutationDeleteUser,
  type TypeAdminUsersPaginationParams,
} from '@/functions/database/users';
import type { TypeAuthData } from '@/functions/database/authentication';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { generateSEO } from '@/functions/utilities/seo';
import { enqueueSnackbar } from 'notistack';
import type { GridColDef, GridFilterModel, GridRenderCellParams } from '@mui/x-data-grid';
import { DataGrid } from '@mui/x-data-grid';

import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LockResetIcon from '@mui/icons-material/LockReset';
import DeleteIcon from '@mui/icons-material/Delete';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';

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
  Tooltip,
  Typography,
} from '@mui/material';

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/space-command/users')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Users - Admin', '', match.pathname),
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

type VerifiedFilter = TypeAdminUsersPaginationParams['verifiedFilter'];

function RouteComponent() {
  const { checkAccess } = useCheckAdminAccess();
  const canDelete = checkAccess(EnumLevelsAdmin.ADMINS_AU);
  const canReset = checkAccess(EnumLevelsAdmin.USERS_AU);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });

  // ── Search (DataGrid toolbar quick-filter → server) ────────────────────────
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });
  const searchTerm = filterModel.quickFilterValues?.join(' ') ?? '';
  const debouncedSearch = useDebounce(searchTerm, 600);

  // ── Verified filter chips ──────────────────────────────────────────────────
  const [verifiedFilter, setVerifiedFilter] = useState<VerifiedFilter>('all');

  function handleVerifiedFilter(next: VerifiedFilter) {
    setVerifiedFilter(next);
    setPaginationModel((p) => ({ ...p, page: 0 }));
  }

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data, isFetching, isError, refetch } = useQueryAdminUsersPaginated({
    page: paginationModel.page,
    pageSize: paginationModel.pageSize,
    search: debouncedSearch,
    verifiedFilter,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const resetPassword = useMutationResetUserPassword();
  const deleteUser = useMutationDeleteUser();

  async function handleResetPassword(user: TypeAuthData) {
    if (!user.email) return;
    try {
      await resetPassword.mutateAsync(user.email);
      enqueueSnackbar(`Password reset email sent to ${user.email}.`, { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to send reset email. Try again.', { variant: 'error' });
    }
  }

  // ── Delete dialog ──────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<TypeAuthData | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteUser.mutateAsync(deleteTarget.id);
      enqueueSnackbar(`Account "${deleteTarget.name || deleteTarget.email}" deleted.`, { variant: 'success' });
      setDeleteTarget(null);
      void refetch();
    } catch {
      enqueueSnackbar('Failed to delete account. Try again.', { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  }

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: GridColDef<TypeAuthData>[] = [
    {
      field: 'name',
      headerName: 'User',
      flex: 1.5,
      minWidth: 200,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeAuthData>) => (
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Avatar sx={{ width: 30, height: 30, fontSize: '0.7rem', bgcolor: 'primary.main', flexShrink: 0 }}>
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
      field: 'verified',
      headerName: 'Verified',
      width: 110,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeAuthData>) =>
        params.row.verified ? (
          <Chip
            icon={<VerifiedUserIcon sx={{ fontSize: '13px !important' }} />}
            label="Verified"
            size="small"
            color="success"
            variant="outlined"
            sx={{ fontSize: '0.68rem', height: 22 }}
          />
        ) : (
          <Chip
            label="Unverified"
            size="small"
            color="error"
            variant="outlined"
            sx={{ fontSize: '0.68rem', height: 22 }}
          />
        ),
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
      width: 110,
      sortable: false,
      disableColumnMenu: true,
      align: 'center',
      renderCell: (params: GridRenderCellParams<TypeAuthData>) => (
        <Stack direction="row" spacing={2} justifyContent="center">
          <Tooltip title="View profile">
            <IconButton
              size="small"
              component="a"
              href={`/profile?id=${params.row.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/*<Tooltip title={canReset ? 'Send password reset email' : 'Requires USERS_AU permission'}>
            <span>
              <IconButton
                size="small"
                disabled={!canReset || resetPassword.isPending}
                onClick={() => handleResetPassword(params.row)}
              >
                <LockResetIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>*/}

          {/*<Tooltip title={canDelete ? 'Delete account' : 'Requires ADMINS_AU permission'}>
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
          </Tooltip>*/}
        </Stack>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <AdminHeaderContainer
        title="Users"
        subtitle={
          <Typography variant="body2" color="text.secondary">
            {(data?.totalItems ?? 0).toLocaleString()} account{(data?.totalItems ?? 1) !== 1 ? 's' : ''}
            {verifiedFilter !== 'all' && ` · filtered by ${verifiedFilter}`}
          </Typography>
        }
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load users. Please refresh and try again.
        </Alert>
      )}

      {/* Verified filter chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {(['all', 'verified', 'unverified'] as VerifiedFilter[]).map((opt) => (
          <Chip
            key={opt}
            label={opt === 'all' ? 'All' : opt === 'verified' ? '✓ Verified' : '✗ Unverified'}
            size="small"
            variant={verifiedFilter === opt ? 'filled' : 'outlined'}
            color={verifiedFilter === opt ? 'primary' : 'default'}
            onClick={() => handleVerifiedFilter(opt)}
            sx={{ textTransform: 'capitalize' }}
          />
        ))}
      </Stack>

      <DataGrid
        columns={columns}
        rows={data?.items ?? []}
        rowCount={data?.totalItems ?? 0}
        loading={isFetching}
        pagination
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[25, 50, 100]}
        sortingMode="server"
        filterMode="server"
        filterModel={filterModel}
        onFilterModelChange={(model) => {
          setFilterModel(model);
          setPaginationModel((p) => ({ ...p, page: 0 }));
        }}
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

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Account</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          <DialogContentText>
            Permanently delete <strong>{deleteTarget?.name || deleteTarget?.email || 'this account'}</strong>?
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
            This cannot be undone. All data associated with this account will be permanently removed.
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
            Delete Account
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
