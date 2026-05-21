import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryGetAllStores, useMutationDeleteStore, type TypeStoreLocation } from '@/functions/database/stores';
import { AdminStoreEditorModal } from '@/components/admin/AdminStoreEditorModal';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { generateSEO } from '@/functions/utilities/seo';

import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined';

import { Alert, Box, Card, CardContent, Chip, IconButton, Skeleton, Stack, Tooltip, Typography } from '@mui/material';

export const Route = createFileRoute('/space-command/store-locator')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Store Locator - Admin', '', match.pathname),
  }),
});

function RouteComponent() {
  const { checkAccess } = useCheckAdminAccess();

  const canAdd = checkAccess(EnumLevelsAdmin.STORE_LOC_AC);
  const canEdit = checkAccess(EnumLevelsAdmin.STORE_LOC_AU);
  const canDelete = checkAccess(EnumLevelsAdmin.STORE_LOC_AD);

  const { data: stores, isLoading, isError, refetch } = useQueryGetAllStores();
  const deleteStore = useMutationDeleteStore();

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

  function handleDelete(id: string, name: string) {
    if (window.confirm(`Delete "${name}"? This cannot be undone.`)) {
      deleteStore.mutate(id, { onSuccess: () => void refetch() });
    }
  }

  return (
    <>
      <AdminHeaderContainer
        title="Store Locator"
        subtitle={
          <>
            {stores?.length ?? 0} store{(stores?.length ?? 0) !== 1 ? 's' : ''}
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

      {isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={110} />
          ))}
        </Box>
      ) : stores && stores.length === 0 ? (
        <Alert severity="info">No stores yet. Click "Add Store" to create the first entry.</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {stores?.map((store) => (
            <StoreCard
              key={store.id}
              store={store}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={() => openEdit(store)}
              onDelete={() => handleDelete(store.id, store.name)}
              isDeleting={deleteStore.isPending}
            />
          ))}
        </Box>
      )}

      <AdminStoreEditorModal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        store={selected}
        onSaved={() => void refetch()}
      />
    </>
  );
}

// ─── Store card sub-component ─────────────────────────────────────────────────

type StoreCardProps = {
  store: TypeStoreLocation;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
};

function StoreCard({ store, canEdit, canDelete, onEdit, onDelete, isDeleting }: StoreCardProps) {
  const tags = Array.isArray(store.tags) ? store.tags : [];

  return (
    <Card variant="outlined" sx={{ '&:hover': { borderColor: 'success.light' } }}>
      <CardContent sx={{ pb: '12px !important' }}>
        <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
          <Box>
            <Typography fontWeight={600}>{store.name}</Typography>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption">{store.id}</Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560, mb: 2 }}>
              {store.description ? store.description : 'No description found'}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0, ml: 2 }}>
            <Tooltip title="Edit">
              <span>
                <IconButton disabled={!canEdit} size="small" onClick={onEdit}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Delete">
              <span>
                <IconButton size="small" color="error" onClick={onDelete} disabled={isDeleting || !canDelete}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Stack>

        {/* Meta row */}
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', mb: 1, alignItems: 'center' }}>
          {store.street_address && (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <PlaceOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.secondary">
                {store.street_address}
              </Typography>
            </Stack>
          )}
          {store.phone && (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <PhoneOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              <Typography variant="caption" color="text.secondary">
                {store.phone}
              </Typography>
            </Stack>
          )}
          {store.website && (
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <LanguageOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              <Typography
                variant="caption"
                component="a"
                href={store.website}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'primary.main' }}
              >
                {store.website.replace(/^https?:\/\//, '')}
              </Typography>
            </Stack>
          )}
          {store.location?.lat != null && (
            <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
              {store.location.lat.toFixed(5)}, {store.location.lon.toFixed(5)}
            </Typography>
          )}
        </Stack>

        {/* Tags */}
        {tags.length > 0 && (
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
            {tags.map((tag) => (
              <Chip key={tag} label={tag} size="small" variant="outlined" sx={{ textTransform: 'capitalize' }} />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
