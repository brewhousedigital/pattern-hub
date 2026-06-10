import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useQueryGetStoresByPagination,
  useMutationDeleteStore,
  type TypeStoreLocation,
} from '@/functions/database/stores';
import { useGlobalAdminPaginationStoreLocator } from '@/data/admin-global-state';
import { AdminStoreEditorModal } from '@/components/admin/AdminStoreEditorModal';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { generateSEO } from '@/functions/utilities/seo';

import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';

import { Alert, Box, Chip, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography } from '@mui/material';

import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid';

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/space-command/store-locator')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Store Locator - Admin', '', match.pathname),
  }),
});

// ─── Component ────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { checkAccess } = useCheckAdminAccess();
  const canAdd = checkAccess(EnumLevelsAdmin.STORE_LOC_AC);
  const canEdit = checkAccess(EnumLevelsAdmin.STORE_LOC_AU);
  const canDelete = checkAccess(EnumLevelsAdmin.STORE_LOC_AD);

  // ── Pagination (persisted in Jotai) ────────────────────────────────────────
  const { paginationModel, setPaginationModel } = useGlobalAdminPaginationStoreLocator();

  // ── Search state (local - three independent fields) ────────────────────────
  const [nameSearch, setNameSearch] = useState('');
  const [addressSearch, setAddressSearch] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');

  const debouncedName = useDebounce(nameSearch, 400);
  const debouncedAddress = useDebounce(addressSearch, 400);
  const debouncedPhone = useDebounce(phoneSearch, 400);

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data, isFetching, isError, refetch } = useQueryGetStoresByPagination({
    page: paginationModel.page,
    pageSize: paginationModel.pageSize,
    nameSearch: debouncedName,
    addressSearch: debouncedAddress,
    phoneSearch: debouncedPhone,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────
  const deleteStore = useMutationDeleteStore();

  function handleDelete(id: string, name: string) {
    if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
      deleteStore.mutate(id, { onSuccess: () => void refetch() });
    }
  }

  // ── Edit / create dialog ───────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<TypeStoreLocation | null>(null);

  function openCreate() {
    setSelected(null);
    setDialogOpen(true);
  }

  function openEdit(store: TypeStoreLocation) {
    setSelected(store);
    setDialogOpen(true);
  }

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: GridColDef<TypeStoreLocation>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1.5,
      minWidth: 180,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeStoreLocation>) => (
        <Box>
          <Typography fontSize={13} fontWeight={600} lineHeight={1.3}>
            {params.row.name}
          </Typography>
          <Typography fontSize={11} color="text.disabled" fontFamily="monospace">
            {params.row.id}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'street_address',
      headerName: 'Address',
      flex: 1,
      minWidth: 160,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeStoreLocation>) =>
        params.row.street_address ? (
          <Typography fontSize={13} color="text.secondary">
            {params.row.street_address}
          </Typography>
        ) : (
          <Typography fontSize={12} color="text.disabled" fontStyle="italic">
            -
          </Typography>
        ),
    },
    {
      field: 'phone',
      headerName: 'Phone',
      width: 150,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeStoreLocation>) =>
        params.row.phone ? (
          <Typography fontSize={13} color="text.secondary">
            {params.row.phone}
          </Typography>
        ) : (
          <Typography fontSize={12} color="text.disabled" fontStyle="italic">
            -
          </Typography>
        ),
    },
    {
      field: 'website',
      headerName: 'Website',
      width: 200,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeStoreLocation>) =>
        params.row.website ? (
          <Typography
            fontSize={12}
            component="a"
            href={params.row.website}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
          >
            {params.row.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          </Typography>
        ) : (
          <Typography fontSize={12} color="text.disabled" fontStyle="italic">
            -
          </Typography>
        ),
    },
    {
      field: 'tags',
      headerName: 'Tags',
      flex: 1,
      minWidth: 140,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeStoreLocation>) => {
        const tags = Array.isArray(params.row.tags) ? params.row.tags : [];
        if (!tags.length)
          return (
            <Typography fontSize={12} color="text.disabled" fontStyle="italic">
              -
            </Typography>
          );
        return (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.4, py: 0.5 }}>
            {tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant="outlined"
                sx={{ textTransform: 'capitalize', fontSize: '0.65rem', height: 18 }}
              />
            ))}
          </Stack>
        );
      },
    },
    {
      field: 'location',
      headerName: 'Coordinates',
      width: 160,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeStoreLocation>) =>
        params.row.location?.lat != null ? (
          <Typography fontSize={11} color="text.disabled" fontFamily="monospace">
            {params.row.location.lat.toFixed(5)}, {params.row.location.lon.toFixed(5)}
          </Typography>
        ) : (
          <Typography fontSize={12} color="text.disabled" fontStyle="italic">
            -
          </Typography>
        ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 88,
      sortable: false,
      disableColumnMenu: true,
      align: 'right',
      renderCell: (params: GridRenderCellParams<TypeStoreLocation>) => (
        <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
          <Tooltip title="Edit">
            <span>
              <IconButton size="small" disabled={!canEdit} onClick={() => openEdit(params.row)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Delete">
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={!canDelete || deleteStore.isPending}
                onClick={() => handleDelete(params.row.id, params.row.name)}
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
        title="Store Locator"
        subtitle={
          <>
            {data?.totalItems ?? 0} store{(data?.totalItems ?? 0) !== 1 ? 's' : ''}
          </>
        }
        action={openCreate}
        actionText="Add Store"
        actionIcon={<AddIcon />}
        disabled={!canAdd}
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load stores. Please refresh and try again.
        </Alert>
      )}

      {/* ── Search filters ─────────────────────────────────────────────────── */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          size="small"
          label="Search by name"
          value={nameSearch}
          onChange={(e) => {
            setNameSearch(e.target.value);
            setPaginationModel((p) => ({ ...p, page: 0 }));
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ flex: 1 }}
        />
        <TextField
          size="small"
          label="Search by address"
          value={addressSearch}
          onChange={(e) => {
            setAddressSearch(e.target.value);
            setPaginationModel((p) => ({ ...p, page: 0 }));
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ flex: 1 }}
        />
        <TextField
          size="small"
          label="Search by phone"
          value={phoneSearch}
          onChange={(e) => {
            setPhoneSearch(e.target.value);
            setPaginationModel((p) => ({ ...p, page: 0 }));
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ flex: 1 }}
        />
      </Stack>

      {/* ── DataGrid ───────────────────────────────────────────────────────── */}
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
        disableRowSelectionOnClick
        getRowHeight={() => 'auto'}
        sx={{
          '& .MuiDataGrid-cell': { alignItems: 'center', py: 0.75 },
        }}
      />

      <AdminStoreEditorModal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        store={selected}
        onSaved={() => void refetch()}
      />
    </>
  );
}
