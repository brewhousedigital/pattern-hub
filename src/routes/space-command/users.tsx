import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useQueryAdminUsersPaginated,
  useMutationResetUserPassword,
  useMutationDeleteUser,
  useMutationSetUserBanned,
  useMutationResetUserName,
  type TypeAdminUsersPaginationParams,
} from '@/functions/database/users';
import type { TypeAuthData } from '@/functions/database/authentication';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { generateSEO } from '@/functions/utilities/seo';
import { enqueueSnackbar } from 'notistack';
import { useAdminLogger } from '@/functions/database/admin-logs';
import type { GridColDef, GridFilterModel, GridRenderCellParams } from '@mui/x-data-grid';
import { DataGrid } from '@mui/x-data-grid';

import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LockResetIcon from '@mui/icons-material/LockReset';
import DeleteIcon from '@mui/icons-material/Delete';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import BlockIcon from '@mui/icons-material/Block';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';

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

export const Route = createFileRoute('/space-command/users')({
  component: RouteComponent,
  head: ({ match }) => generateSEO('Users - Admin', '', match.pathname),
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
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

type VerifiedFilter = TypeAdminUsersPaginationParams['verifiedFilter'];
type BannedFilter = TypeAdminUsersPaginationParams['bannedFilter'];

function RouteComponent() {
  const { checkAccess } = useCheckAdminAccess();
  const canDelete = checkAccess(EnumLevelsAdmin.ADMINS_AU);
  const canReset = checkAccess(EnumLevelsAdmin.USERS_AU);
  const canModerate = checkAccess(EnumLevelsAdmin.USERS_AU);

  // ── Pagination ─────────────────────────────────────────────────────────────
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });

  // ── Search (DataGrid toolbar quick-filter → server) ────────────────────────
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [] });
  const searchTerm = filterModel.quickFilterValues?.join(' ') ?? '';
  const debouncedSearch = useDebounce(searchTerm, 600);

  // ── Verified / banned filter chips ─────────────────────────────────────────
  const [verifiedFilter, setVerifiedFilter] = useState<VerifiedFilter>('all');
  const [bannedFilter, setBannedFilter] = useState<BannedFilter>('all');

  function handleVerifiedFilter(next: VerifiedFilter) {
    setVerifiedFilter(next);
    setPaginationModel((p) => ({ ...p, page: 0 }));
  }

  function handleBannedFilter(next: BannedFilter) {
    setBannedFilter(next);
    setPaginationModel((p) => ({ ...p, page: 0 }));
  }

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data, isFetching, isError, refetch } = useQueryAdminUsersPaginated({
    page: paginationModel.page,
    pageSize: paginationModel.pageSize,
    search: debouncedSearch,
    verifiedFilter,
    bannedFilter,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const resetPassword = useMutationResetUserPassword();
  const deleteUser = useMutationDeleteUser();
  const setUserBanned = useMutationSetUserBanned();
  const resetUserName = useMutationResetUserName();
  const { log } = useAdminLogger();

  async function handleResetPassword(user: TypeAuthData) {
    if (!user.email) return;
    try {
      await resetPassword.mutateAsync(user.email);
      log({
        action: 'User Password Reset',
        entity_type: 'User',
        entity_id: user.id,
        entity_name: user.name || user.email,
        changes: {},
        metadata: { email: user.email },
      });
      enqueueSnackbar(`Password reset email sent to ${user.email}.`, { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to send reset email. Try again.', { variant: 'error' });
    }
  }

  // ── Ban dialog ─────────────────────────────────────────────────────────────
  const [banTarget, setBanTarget] = useState<TypeAuthData | null>(null);
  const [banReason, setBanReason] = useState('');

  async function confirmBan() {
    if (!banTarget) return;
    try {
      await setUserBanned.mutateAsync({ userId: banTarget.id, banned: true, reason: banReason.trim() });
      log({
        action: 'User Banned',
        entity_type: 'User',
        entity_id: banTarget.id,
        entity_name: banTarget.name || banTarget.id,
        changes: {},
        metadata: { reason: banReason.trim() },
      });
      enqueueSnackbar(`"${banTarget.name || banTarget.id}" has been banned.`, { variant: 'success' });
      setBanTarget(null);
      setBanReason('');
      void refetch();
    } catch {
      enqueueSnackbar('Failed to ban user. Try again.', { variant: 'error' });
    }
  }

  async function handleUnban(user: TypeAuthData) {
    try {
      await setUserBanned.mutateAsync({ userId: user.id, banned: false });
      log({
        action: 'User Unbanned',
        entity_type: 'User',
        entity_id: user.id,
        entity_name: user.name || user.id,
        changes: {},
        metadata: {},
      });
      enqueueSnackbar(`"${user.name || user.id}" has been unbanned.`, { variant: 'success' });
      void refetch();
    } catch {
      enqueueSnackbar('Failed to unban user. Try again.', { variant: 'error' });
    }
  }

  // ── Name-reset dialog ──────────────────────────────────────────────────────
  const [renameTarget, setRenameTarget] = useState<TypeAuthData | null>(null);

  async function confirmNameReset() {
    if (!renameTarget) return;
    try {
      const { name } = await resetUserName.mutateAsync(renameTarget.id);
      log({
        action: 'User Name Reset',
        entity_type: 'User',
        entity_id: renameTarget.id,
        entity_name: renameTarget.name || renameTarget.id,
        changes: { name: { from: renameTarget.name, to: name } },
        metadata: {},
      });
      enqueueSnackbar(`Name reset to "${name}".`, { variant: 'success' });
      setRenameTarget(null);
      void refetch();
    } catch {
      enqueueSnackbar('Failed to reset name. Try again.', { variant: 'error' });
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
      log({
        action: 'User Account Deleted',
        entity_type: 'User',
        entity_id: deleteTarget.id,
        entity_name: deleteTarget.name || deleteTarget.email || deleteTarget.id,
        changes: {},
        metadata: { email: deleteTarget.email },
      });
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
        <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
          <Avatar sx={{ width: 30, height: 30, fontSize: '0.7rem', backgroundColor: 'primary.main', flexShrink: 0 }}>
            {initialsOf(params.row.name)}
          </Avatar>
          <Box>
            <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
              {params.row.name || <em style={{ opacity: 0.5 }}>No name</em>}
            </Typography>
            <Typography color="text.disabled" sx={{ fontSize: 11, fontFamily: 'monospace' }}>
              {params.row.id}
            </Typography>
          </Box>
        </Stack>
      ),
    },
    {
      field: 'verified',
      headerName: 'Status',
      width: 200,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeAuthData>) => (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          {params.row.verified ? (
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
          )}

          {params.row.banned && (
            <Tooltip title={params.row.banned_reason || 'No reason recorded'}>
              <Chip
                icon={<BlockIcon sx={{ fontSize: '13px !important' }} />}
                label="Banned"
                size="small"
                color="error"
                sx={{ fontSize: '0.68rem', height: 22, fontWeight: 700 }}
              />
            </Tooltip>
          )}
        </Stack>
      ),
    },
    {
      field: 'created',
      headerName: 'Joined',
      width: 130,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeAuthData>) => (
        <Typography sx={{ fontSize: 12 }} color="text.secondary">
          {formatDate(params.row.created)}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 160,
      sortable: false,
      disableColumnMenu: true,
      align: 'center',
      renderCell: (params: GridRenderCellParams<TypeAuthData>) => (
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'center' }}>
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

          <Tooltip title={canModerate ? 'Reset display name' : 'Requires USERS_AU permission'}>
            <span>
              <IconButton
                size="small"
                disabled={!canModerate || resetUserName.isPending}
                onClick={() => setRenameTarget(params.row)}
              >
                <DriveFileRenameOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          {params.row.banned ? (
            <Tooltip title={canModerate ? 'Unban user' : 'Requires USERS_AU permission'}>
              <span>
                <IconButton
                  size="small"
                  color="success"
                  disabled={!canModerate || setUserBanned.isPending}
                  onClick={() => handleUnban(params.row)}
                >
                  <HowToRegIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          ) : (
            <Tooltip title={canModerate ? 'Ban user' : 'Requires USERS_AU permission'}>
              <span>
                <IconButton
                  size="small"
                  color="error"
                  disabled={!canModerate || setUserBanned.isPending}
                  onClick={() => {
                    setBanReason('');
                    setBanTarget(params.row);
                  }}
                >
                  <BlockIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}

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

      {/* Verified / banned filter chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
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

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {(['all', 'active', 'banned'] as BannedFilter[]).map((opt) => (
          <Chip
            key={`banned-${opt}`}
            label={opt === 'all' ? 'All' : opt === 'active' ? 'Active' : '⛔ Banned'}
            size="small"
            variant={bannedFilter === opt ? 'filled' : 'outlined'}
            color={bannedFilter === opt ? (opt === 'banned' ? 'error' : 'primary') : 'default'}
            onClick={() => handleBannedFilter(opt)}
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

      {/* Ban dialog */}
      <Dialog
        open={!!banTarget}
        onClose={() => !setUserBanned.isPending && setBanTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Ban User</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          <DialogContentText sx={{ mb: 2 }}>
            Ban <strong>{banTarget?.name || banTarget?.id}</strong>? They will be signed out on their next visit,
            unable to log in or post content, and their public profile and gallery will be hidden. Their data is
            kept and this can be undone at any time.
          </DialogContentText>
          <TextField
            label="Reason"
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            helperText="Shown to the user if they attempt to log in."
          />
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button
            onClick={() => setBanTarget(null)}
            variant="outlined"
            disabled={setUserBanned.isPending}
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmBan}
            variant="contained"
            color="error"
            loading={setUserBanned.isPending}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            Ban User
          </Button>
        </DialogActions>
      </Dialog>

      {/* Name-reset dialog */}
      <Dialog
        open={!!renameTarget}
        onClose={() => !resetUserName.isPending && setRenameTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Reset Display Name</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          <DialogContentText>
            Reset <strong>{renameTarget?.name || renameTarget?.id}</strong> to a neutral placeholder name
            (User_{renameTarget?.id.slice(0, 8)})? Use this when a name impersonates an admin or another person. The
            user can choose a new name from their profile settings afterwards.
          </DialogContentText>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button
            onClick={() => setRenameTarget(null)}
            variant="outlined"
            disabled={resetUserName.isPending}
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmNameReset}
            variant="contained"
            color="warning"
            loading={resetUserName.isPending}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            Reset Name
          </Button>
        </DialogActions>
      </Dialog>

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
