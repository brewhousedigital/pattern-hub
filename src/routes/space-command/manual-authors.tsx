import React, { useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo';
import {
  MANUAL_AUTHORS_QUERY_KEY,
  nameToSlug,
  useQueryGetAllManualAuthors,
  useMutationCreateManualAuthor,
  useMutationUpdateManualAuthor,
  useMutationDeleteManualAuthor,
  type TypeManualAuthor,
} from '@/functions/database/manual-authors';
import { generateManualAuthorAvatarUrl } from '@/functions/utilities/generate-pb-image';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { GenericMarkdownEditor } from '@/components/admin/GenericMarkdownEditor';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { useAdminLogger, diffAdminChanges } from '@/functions/database/admin-logs';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { DataGrid } from '@mui/x-data-grid';

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';

import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/space-command/manual-authors')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Manual Authors - Admin', '', match.pathname),
  }),
});

// ─── Component ────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { checkAccess } = useCheckAdminAccess();
  const canView = checkAccess(EnumLevelsAdmin.MANUAL_AUTHOR_AR);
  const canCreate = checkAccess(EnumLevelsAdmin.MANUAL_AUTHOR_AC);
  const canEdit = checkAccess(EnumLevelsAdmin.MANUAL_AUTHOR_AU);
  const canDelete = checkAccess(EnumLevelsAdmin.MANUAL_AUTHOR_AD);

  const { data: authors = [], isPending, isError } = useQueryGetAllManualAuthors();
  const createMutation = useMutationCreateManualAuthor();
  const updateMutation = useMutationUpdateManualAuthor();
  const deleteMutation = useMutationDeleteManualAuthor();
  const queryClient = useQueryClient();
  const { log } = useAdminLogger();

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TypeManualAuthor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TypeManualAuthor | null>(null);

  // ── Form state ────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-generate slug from name unless admin has manually edited it
  useEffect(() => {
    if (!slugManuallyEdited) setSlug(nameToSlug(name));
  }, [name, slugManuallyEdited]);

  const openCreate = () => {
    setEditTarget(null);
    setName('');
    setSlug('');
    setSlugManuallyEdited(false);
    setDescription('');
    setExternalUrl('');
    setIsPublished(false);
    setAvatarFile(null);
    setAvatarPreview(null);
    setModalOpen(true);
  };

  const openEdit = (author: TypeManualAuthor) => {
    setEditTarget(author);
    setName(author.name);
    setSlug(author.slug);
    setSlugManuallyEdited(true);
    setDescription(author.description);
    setExternalUrl(author.external_url);
    setIsPublished(author.is_published);
    setAvatarFile(null);
    setAvatarPreview(generateManualAuthorAvatarUrl(author));
    setModalOpen(true);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) {
      enqueueSnackbar('Name and slug are required.', { variant: 'warning' });
      return;
    }

    const formData = new FormData();
    formData.append('name', name.trim());
    formData.append('slug', slug.trim());
    formData.append('description', description);
    formData.append('external_url', externalUrl.trim());
    formData.append('is_published', String(isPublished));
    if (avatarFile) formData.append('avatar', avatarFile);

    try {
      if (editTarget) {
        const updated = await updateMutation.mutateAsync({ id: editTarget.id, formData });
        log({
          action: 'Manual Author Updated',
          entity_type: 'Manual Author',
          entity_id: editTarget.id,
          entity_name: updated.name,
          changes: diffAdminChanges(
            {
              name: editTarget.name,
              slug: editTarget.slug,
              is_published: String(editTarget.is_published),
              external_url: editTarget.external_url,
            } as Record<string, unknown>,
            {
              name: updated.name,
              slug: updated.slug,
              is_published: String(updated.is_published),
              external_url: updated.external_url,
            } as Record<string, unknown>,
            ['name', 'slug', 'is_published', 'external_url'],
            avatarFile ? ['avatar'] : [],
          ),
          metadata: {},
        });
        enqueueSnackbar(`"${updated.name}" updated.`, { variant: 'success' });
      } else {
        const created = await createMutation.mutateAsync(formData);
        log({
          action: 'Manual Author Created',
          entity_type: 'Manual Author',
          entity_id: created.id,
          entity_name: created.name,
          changes: {},
          metadata: { slug: created.slug, is_published: created.is_published },
        });
        enqueueSnackbar(`"${created.name}" created.`, { variant: 'success' });
      }
      setModalOpen(false);
      queryClient.invalidateQueries({ queryKey: MANUAL_AUTHORS_QUERY_KEY });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      enqueueSnackbar(`Error: ${msg}`, { variant: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      log({
        action: 'Manual Author Deleted',
        entity_type: 'Manual Author',
        entity_id: deleteTarget.id,
        entity_name: deleteTarget.name,
        changes: {},
        metadata: {},
      });
      enqueueSnackbar(`"${deleteTarget.name}" deleted.`, { variant: 'success' });
      setDeleteTarget(null);
    } catch {
      enqueueSnackbar('Delete failed.', { variant: 'error' });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── DataGrid columns ──────────────────────────────────────────────────────
  const columns: GridColDef[] = [
    {
      field: 'avatar',
      headerName: '',
      width: 56,
      sortable: false,
      renderCell: (params: GridRenderCellParams<TypeManualAuthor>) => (
        <Avatar src={generateManualAuthorAvatarUrl(params.row) ?? undefined} sx={{ width: 36, height: 36 }}>
          <PersonRoundedIcon fontSize="small" />
        </Avatar>
      ),
    },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 180 },
    { field: 'slug', headerName: 'Slug', flex: 1, minWidth: 160 },
    {
      field: 'is_published',
      headerName: 'Published',
      width: 100,
      renderCell: (params: GridRenderCellParams<TypeManualAuthor>) =>
        params.row.is_published ? (
          <CheckCircleRoundedIcon color="success" fontSize="small" />
        ) : (
          <RadioButtonUncheckedRoundedIcon color="disabled" fontSize="small" />
        ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: (params: GridRenderCellParams<TypeManualAuthor>) => (
        <Stack direction="row" spacing={0.5}>
          {canEdit && (
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => openEdit(params.row)}>
                <EditRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip title="Delete">
              <IconButton size="small" color="error" onClick={() => setDeleteTarget(params.row)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      ),
    },
  ];

  if (!canView) {
    return (
      <Alert severity="error" sx={{ m: 3 }}>
        You do not have permission to view this page.
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <AdminHeaderContainer
        title="Manual Authors"
        subtitle={`${authors.length} author page${authors.length !== 1 ? 's' : ''}`}
        action={canCreate ? openCreate : undefined}
        actionText="New Author"
        actionIcon={<AddRoundedIcon />}
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load manual authors.
        </Alert>
      )}

      <DataGrid
        rows={authors}
        columns={columns}
        loading={isPending}
        autoHeight
        disableRowSelectionOnClick
        pageSizeOptions={[25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        sx={{ borderRadius: 2 }}
      />

      {/* ── Create / Edit modal ─────────────────────────────────────────── */}
      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editTarget ? `Edit "${editTarget.name}"` : 'New Manual Author'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {/* Avatar upload */}
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Avatar
                src={avatarPreview ?? undefined}
                sx={{ width: 72, height: 72, cursor: 'pointer' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <PersonRoundedIcon />
              </Avatar>
              <Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PhotoCameraRoundedIcon />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarPreview ? 'Change Photo' : 'Upload Photo'}
                </Button>
                <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                  JPG or PNG, max 2 MB
                </Typography>
              </Box>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
            </Stack>

            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              size="small"
              helperText="Must exactly match the author_manual string on patterns (case-sensitive)"
            />

            <TextField
              label="Slug"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugManuallyEdited(true);
              }}
              required
              fullWidth
              size="small"
              helperText={`Public URL: /authors/${slug || '...'}`}
            />

            <TextField
              label="External URL"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              fullWidth
              size="small"
              placeholder="https://en.wikipedia.org/wiki/..."
            />

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Description (Markdown)
              </Typography>
              <GenericMarkdownEditor content={description} setContent={setDescription} />
            </Box>

            <FormControlLabel
              control={<Switch checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />}
              label="Published (visible to the public)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} loading={isSaving}>
            {editTarget ? 'Save Changes' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete confirm ──────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Author Page?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the page for <strong>{deleteTarget?.name}</strong>? Pattern links will
            revert to plain text. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" variant="contained" loading={deleteMutation.isPending} onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
