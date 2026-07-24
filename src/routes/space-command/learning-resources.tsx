import React, { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo';
import {
  LEARNING_RESOURCES_QUERY_KEY,
  useQueryGetAllResources,
  useMutationCreateResource,
  useMutationUpdateResource,
  useMutationDeleteResource,
  type TypeLearningResource,
  type TypeLearningResourcePayload,
} from '@/functions/database/learning-resources';
import {
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
  RESOURCE_TYPE_ICONS,
  RESOURCE_TYPE_COLORS,
  type TypeResourceType,
} from '@/functions/utilities/resource-types';
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

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/space-command/learning-resources')({
  component: RouteComponent,
  head: ({ match }) => generateSEO('Learning Resources - Admin', '', match.pathname),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso?: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { checkAccess } = useCheckAdminAccess();
  const canCreate = checkAccess(EnumLevelsAdmin.LEARN_AC);
  const canEdit = checkAccess(EnumLevelsAdmin.LEARN_AU);
  const canDelete = checkAccess(EnumLevelsAdmin.LEARN_AD);

  const queryClient = useQueryClient();
  const { data, isPending, isFetching, isError } = useQueryGetAllResources();

  // ── Delete dialog ──────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<TypeLearningResource | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteResource = useMutationDeleteResource();
  const { log } = useAdminLogger();

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteResource.mutateAsync(deleteTarget.id);
      log({
        action: 'Learning Resource Deleted',
        entity_type: 'Learning Resource',
        entity_id: deleteTarget.id,
        entity_name: deleteTarget.title,
        changes: {},
        metadata: { resource_type: deleteTarget.resource_type },
      });
      enqueueSnackbar(`"${deleteTarget.title}" deleted.`, { variant: 'success' });
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: LEARNING_RESOURCES_QUERY_KEY });
    } catch {
      enqueueSnackbar('Failed to delete resource. Try again.', { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  }

  // ── Edit dialog ────────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<TypeLearningResource | null>(null);

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: GridColDef<TypeLearningResource>[] = [
    {
      field: 'title',
      headerName: 'Title',
      flex: 1.5,
      minWidth: 200,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeLearningResource>) => {
        const Icon = RESOURCE_TYPE_ICONS[params.row.resource_type];
        return (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Icon sx={{ fontSize: 18, color: RESOURCE_TYPE_COLORS[params.row.resource_type], flexShrink: 0 }} />
            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{params.row.title}</Typography>
          </Stack>
        );
      },
    },
    {
      field: 'resource_type',
      headerName: 'Type',
      width: 150,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeLearningResource>) => (
        <Chip
          label={RESOURCE_TYPE_LABELS[params.row.resource_type]}
          size="small"
          variant="outlined"
          sx={{
            fontSize: '0.7rem',
            height: 22,
            borderColor: RESOURCE_TYPE_COLORS[params.row.resource_type],
            color: RESOURCE_TYPE_COLORS[params.row.resource_type],
          }}
        />
      ),
    },
    {
      field: 'url',
      headerName: 'URL',
      flex: 1.5,
      minWidth: 180,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeLearningResource>) => (
        <Typography
          component="a"
          href={params.row.url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            fontSize: 12,
            color: 'primary.main',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
            maxWidth: '100%',
          }}
        >
          {params.row.url}
        </Typography>
      ),
    },
    {
      field: 'tags',
      headerName: 'Tags',
      flex: 1,
      minWidth: 160,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeLearningResource>) => {
        const tags = params.row.tags ?? [];
        const visible = tags.slice(0, 3);
        const remaining = tags.length - visible.length;
        return (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, py: 0.5 }}>
            {visible.map((tag) => (
              <Chip key={tag} label={tag} size="small" sx={{ fontSize: '0.65rem', height: 20 }} />
            ))}
            {remaining > 0 && <Chip label={`+${remaining}`} size="small" sx={{ fontSize: '0.65rem', height: 20 }} />}
          </Stack>
        );
      },
    },
    {
      field: 'is_published',
      headerName: 'Published',
      width: 110,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeLearningResource>) =>
        params.row.is_published ? (
          <Chip
            icon={<CheckCircleRoundedIcon sx={{ fontSize: '13px !important' }} />}
            label="Published"
            size="small"
            color="success"
            variant="outlined"
            sx={{ fontSize: '0.68rem', height: 22 }}
          />
        ) : (
          <Chip
            icon={<RadioButtonUncheckedRoundedIcon sx={{ fontSize: '13px !important' }} />}
            label="Draft"
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.68rem', height: 22, color: 'text.disabled' }}
          />
        ),
    },
    {
      field: 'created',
      headerName: 'Created',
      width: 130,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypeLearningResource>) => (
        <Typography sx={{ fontSize: 12 }} color="text.secondary">
          {formatDate(params.row.created)}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 90,
      sortable: false,
      disableColumnMenu: true,
      align: 'center',
      renderCell: (params: GridRenderCellParams<TypeLearningResource>) => (
        <Stack direction="row" spacing={0.25} sx={{ justifyContent: 'center' }}>
          <Tooltip title={canEdit ? 'Edit resource' : 'Requires LEARN_AU permission'}>
            <span>
              <IconButton size="small" disabled={!canEdit} onClick={() => setEditTarget(params.row)}>
                <EditRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={canDelete ? 'Delete resource' : 'Requires LEARN_AD permission'}>
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
        title="Learning Resources"
        subtitle={
          <Typography variant="body2" color="text.secondary">
            {(data?.length ?? 0).toLocaleString()} resource{(data?.length ?? 1) !== 1 ? 's' : ''} ·{' '}
            {data?.filter((r) => r.is_published)?.length ?? 0} published
          </Typography>
        }
        actionNode={
          canCreate ? (
            <ResourceEditorDialog
              mode="create"
              onSaved={() => void queryClient.invalidateQueries({ queryKey: LEARNING_RESOURCES_QUERY_KEY })}
            />
          ) : undefined
        }
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load learning resources. Please refresh and try again.
        </Alert>
      )}

      <DataGrid
        columns={columns}
        rows={data ?? []}
        rowCount={data?.length ?? 0}
        loading={isPending || isFetching}
        hideFooterPagination
        showToolbar
        disableRowSelectionOnClick
        getRowHeight={() => 'auto'}
        sx={{ '& .MuiDataGrid-cell': { alignItems: 'center', py: 0.75 } }}
        initialState={{ columns: { columnVisibilityModel: { id: false } } }}
      />

      {/* Edit dialog */}
      {editTarget && (
        <ResourceEditorDialog
          mode="edit"
          resource={editTarget}
          open
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            void queryClient.invalidateQueries({ queryKey: LEARNING_RESOURCES_QUERY_KEY });
          }}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Learning Resource</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          <DialogContentText>
            Permanently delete <strong>{deleteTarget?.title || 'this resource'}</strong>?
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
            Delete Resource
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ─── ResourceEditorDialog ─────────────────────────────────────────────────────

type ResourceEditorDialogProps =
  | { mode: 'create'; onSaved: () => void }
  | { mode: 'edit'; resource: TypeLearningResource; open: boolean; onClose: () => void; onSaved: () => void };

function ResourceEditorDialog(props: ResourceEditorDialogProps) {
  const isEdit = props.mode === 'edit';
  const resource = isEdit ? props.resource : undefined;
  const [open, setOpen] = useState(false);

  const dialogOpen = isEdit ? props.open : open;
  const handleClose = () => {
    if (isEdit) {
      props.onClose();
    } else {
      setOpen(false);
    }
  };

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [resourceType, setResourceType] = useState<TypeResourceType>('video');
  const [tags, setTags] = useState<string[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (resource) {
      setTitle(resource.title ?? '');
      setDescription(resource.description ?? '');
      setUrl(resource.url ?? '');
      setResourceType(resource.resource_type ?? 'video');
      setTags(Array.isArray(resource.tags) ? resource.tags : []);
      setIsPublished(resource.is_published ?? false);
    }
  }, [resource]);

  // Reset form when closed (create mode only - edit mode unmounts via editTarget)
  useEffect(() => {
    if (!dialogOpen && !isEdit) {
      setTitle('');
      setDescription('');
      setUrl('');
      setResourceType('video');
      setTags([]);
      setIsPublished(false);
      setSaving(false);
    }
  }, [dialogOpen, isEdit]);

  const createResource = useMutationCreateResource();
  const updateResource = useMutationUpdateResource();
  const { log } = useAdminLogger();

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    setSaving(true);
    try {
      const payload: TypeLearningResourcePayload = {
        title: title.trim(),
        description: description.trim(),
        url: url.trim(),
        resource_type: resourceType,
        tags,
        is_published: isPublished,
      };

      if (resource) {
        await updateResource.mutateAsync({ id: resource.id, payload });
        log({
          action: 'Learning Resource Updated',
          entity_type: 'Learning Resource',
          entity_id: resource.id,
          entity_name: title.trim(),
          changes: diffAdminChanges(
            {
              title: resource.title,
              description: resource.description,
              url: resource.url,
              resource_type: resource.resource_type,
              tags: JSON.stringify(resource.tags ?? []),
              is_published: String(resource.is_published),
            } as Record<string, unknown>,
            {
              title: payload.title,
              description: payload.description ?? '',
              url: payload.url,
              resource_type: payload.resource_type,
              tags: JSON.stringify(payload.tags ?? []),
              is_published: String(payload.is_published),
            } as Record<string, unknown>,
            ['title', 'description', 'url', 'resource_type', 'tags', 'is_published'],
          ),
          metadata: {},
        });
        enqueueSnackbar(`"${title}" updated.`, { variant: 'success' });
      } else {
        const created = await createResource.mutateAsync(payload);
        log({
          action: 'Learning Resource Created',
          entity_type: 'Learning Resource',
          entity_id: created?.id ?? '',
          entity_name: title.trim(),
          changes: {},
          metadata: { resource_type: resourceType, is_published: isPublished },
        });
        enqueueSnackbar(`"${title}" created.`, { variant: 'success' });
      }

      props.onSaved();
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      enqueueSnackbar(`Failed to save resource: ${msg}`, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {!isEdit && (
        <Button variant="contained" color="success" startIcon={<AddRoundedIcon />} onClick={() => setOpen(true)}>
          New Resource
        </Button>
      )}

      <Dialog open={dialogOpen} onClose={() => !saving && handleClose()} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{isEdit ? 'Edit Learning Resource' : 'New Learning Resource'}</DialogTitle>
        <Divider />
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2.5 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                fullWidth
                variant="filled"
                autoFocus={!isEdit}
              />

              <FormControl fullWidth variant="filled" required sx={{ minWidth: 220 }}>
                <InputLabel id="resource-type-label">Resource Type</InputLabel>
                <Select
                  labelId="resource-type-label"
                  label="Resource Type"
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value as TypeResourceType)}
                >
                  {RESOURCE_TYPES.map((type) => {
                    const Icon = RESOURCE_TYPE_ICONS[type];
                    return (
                      <MenuItem key={type} value={type}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Icon fontSize="small" sx={{ color: RESOURCE_TYPE_COLORS[type] }} />
                          <span>{RESOURCE_TYPE_LABELS[type]}</span>
                        </Stack>
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </Stack>

            <TextField
              label="URL"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              fullWidth
              variant="filled"
              placeholder="https://…"
            />

            <GenericMarkdownEditor content={description} setContent={setDescription} characterLimit={2000} />

            <Autocomplete
              multiple
              freeSolo
              disableClearable
              options={[]}
              value={tags}
              onChange={(_, newValue) => setTags(newValue as string[])}
              slotProps={{ chip: { size: 'small' } }}
              renderInput={(params) => (
                <TextField {...params} variant="filled" label="Tags" placeholder="Type a tag and press Enter…" />
              )}
            />

            <FormControlLabel
              control={
                <Switch checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} color="success" />
              }
              label={
                <Stack>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {isPublished ? 'Published' : 'Draft'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {isPublished
                      ? 'Visible to everyone on the public Learning Resources page'
                      : 'Only visible to admins - not shown publicly'}
                  </Typography>
                </Stack>
              }
            />
          </DialogContent>

          <Divider />
          <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
            <Button onClick={handleClose} variant="outlined" disabled={saving} sx={{ borderRadius: 2 }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              loading={saving}
              disabled={!title.trim() || !url.trim()}
              sx={{ borderRadius: 2, fontWeight: 700 }}
            >
              {isEdit ? 'Save Changes' : 'Create Resource'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
