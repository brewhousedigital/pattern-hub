import React, { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo';
import {
  PATTERN_SETS_QUERY_KEY,
  useQueryGetAllSets,
  useQueryGetSetById,
  useQuerySearchPatternsForPicker,
  useMutationCreateSet,
  useMutationUpdateSet,
  useMutationDeleteSet,
  type TypePatternSet,
  type TypePatternSetPayload,
} from '@/functions/database/sets';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { DataGrid } from '@mui/x-data-grid';

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/space-command/sets')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Sets - Admin', '', match.pathname),
  }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCENT_COLORS = [
  { label: 'None', value: '' },
  { label: 'Blue', value: '#1565c0' },
  { label: 'Purple', value: '#6a1b9a' },
  { label: 'Green', value: '#2e7d32' },
  { label: 'Teal', value: '#00695c' },
  { label: 'Orange', value: '#e65100' },
  { label: 'Red', value: '#c62828' },
  { label: 'Pink', value: '#ad1457' },
];

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { checkAccess } = useCheckAdminAccess();
  const canCreate = checkAccess(EnumLevelsAdmin.SETS_AC);
  const canEdit = checkAccess(EnumLevelsAdmin.SETS_AU);
  const canDelete = checkAccess(EnumLevelsAdmin.SETS_AD);

  const queryClient = useQueryClient();
  const { data, isPending, isFetching, isError, refetch } = useQueryGetAllSets();

  // ── Delete dialog ──────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<TypePatternSet | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteSet = useMutationDeleteSet();

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSet.mutateAsync(deleteTarget.id);
      enqueueSnackbar(`Set "${deleteTarget.title}" deleted.`, { variant: 'success' });
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: PATTERN_SETS_QUERY_KEY });
    } catch {
      enqueueSnackbar('Failed to delete set. Try again.', { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  }

  // ── Edit dialog ────────────────────────────────────────────────────────────
  const [editTarget, setEditTarget] = useState<TypePatternSet | null>(null);

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: GridColDef<TypePatternSet>[] = [
    {
      field: 'title',
      headerName: 'Title',
      flex: 1.5,
      minWidth: 200,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypePatternSet>) => (
        <Stack direction="row" spacing={1.5} alignItems="center">
          {params.row.color && (
            <Box sx={{ width: 4, height: 28, borderRadius: 1, bgcolor: params.row.color, flexShrink: 0 }} />
          )}
          <Typography fontSize={13} fontWeight={600}>
            {params.row.title}
          </Typography>
        </Stack>
      ),
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 2,
      minWidth: 200,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypePatternSet>) => (
        <Typography
          fontSize={12}
          color="text.secondary"
          sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {params.row.description || <em style={{ opacity: 0.5 }}>No description</em>}
        </Typography>
      ),
    },
    {
      field: 'patterns',
      headerName: 'Patterns',
      width: 100,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypePatternSet>) => (
        <Chip
          label={params.row.patterns?.length ?? 0}
          size="small"
          icon={<StyleRoundedIcon sx={{ fontSize: '13px !important' }} />}
          variant="outlined"
          sx={{ fontSize: '0.7rem', height: 22 }}
        />
      ),
    },
    {
      field: 'is_published',
      headerName: 'Published',
      width: 110,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypePatternSet>) =>
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
      field: 'position',
      headerName: 'Order',
      width: 80,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypePatternSet>) => (
        <Typography fontSize={12} color="text.secondary">
          {params.row.position ?? '—'}
        </Typography>
      ),
    },
    {
      field: 'created',
      headerName: 'Created',
      width: 130,
      sortable: false,
      disableColumnMenu: true,
      renderCell: (params: GridRenderCellParams<TypePatternSet>) => (
        <Typography fontSize={12} color="text.secondary">
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
      renderCell: (params: GridRenderCellParams<TypePatternSet>) => (
        <Stack direction="row" spacing={0.25} justifyContent="center">
          <Tooltip title={canEdit ? 'Edit set' : 'Requires SETS_AU permission'}>
            <span>
              <IconButton size="small" disabled={!canEdit} onClick={() => setEditTarget(params.row)}>
                <EditRoundedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title={canDelete ? 'Delete set' : 'Requires SETS_AD permission'}>
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
        title="Sets"
        subtitle={
          <Typography variant="body2" color="text.secondary">
            {(data?.length ?? 0).toLocaleString()} set{(data?.length ?? 1) !== 1 ? 's' : ''} ·{' '}
            {data?.filter((s) => s.is_published)?.length ?? 0} published
          </Typography>
        }
        actionNode={
          canCreate ? (
            <SetEditorDialog
              mode="create"
              onSaved={() => void queryClient.invalidateQueries({ queryKey: PATTERN_SETS_QUERY_KEY })}
            />
          ) : undefined
        }
      />

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load sets. Please refresh and try again.
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
        <SetEditorDialog
          mode="edit"
          setId={editTarget.id}
          open
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            void queryClient.invalidateQueries({ queryKey: PATTERN_SETS_QUERY_KEY });
          }}
        />
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Set</DialogTitle>
        <Divider />
        <DialogContent sx={{ pt: 2.5 }}>
          <DialogContentText>
            Permanently delete <strong>{deleteTarget?.title || 'this set'}</strong>?
          </DialogContentText>
          <DialogContentText sx={{ mt: 1.5, color: 'error.main', fontSize: 13 }}>
            The patterns themselves will not be deleted — only the set grouping.
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
            Delete Set
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ─── SetEditorDialog ──────────────────────────────────────────────────────────

type SetEditorDialogProps =
  | { mode: 'create'; onSaved: () => void }
  | { mode: 'edit'; setId: string; open: boolean; onClose: () => void; onSaved: () => void };

function SetEditorDialog(props: SetEditorDialogProps) {
  const isEdit = props.mode === 'edit';
  const [open, setOpen] = useState(false);

  const dialogOpen = isEdit ? props.open : open;
  const handleClose = () => {
    if (isEdit) {
      props.onClose();
    } else {
      setOpen(false);
    }
  };

  // Fetch existing set when editing
  const { data: existingSet } = useQueryGetSetById(isEdit ? props.setId : undefined);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');
  const [position, setPosition] = useState<number | ''>('');
  const [isPublished, setIsPublished] = useState(false);
  const [selectedPatterns, setSelectedPatterns] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (existingSet && isEdit) {
      setTitle(existingSet.title ?? '');
      setDescription(existingSet.description ?? '');
      setColor(existingSet.color ?? '');
      setPosition(existingSet.position ?? '');
      setIsPublished(existingSet.is_published ?? false);
      setSelectedPatterns(
        existingSet.expand?.patterns?.map((p) => ({ id: p.id, name: p.name })) ??
          existingSet.patterns?.map((id) => ({ id, name: id })) ??
          [],
      );
    }
  }, [existingSet, isEdit]);

  // Reset form when closed
  useEffect(() => {
    if (!dialogOpen && !isEdit) {
      setTitle('');
      setDescription('');
      setColor('');
      setPosition('');
      setIsPublished(false);
      setSelectedPatterns([]);
      setSaving(false);
    }
  }, [dialogOpen, isEdit]);

  const createSet = useMutationCreateSet();
  const updateSet = useMutationUpdateSet();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload: TypePatternSetPayload = {
        title: title.trim(),
        description: description.trim(),
        color,
        position: position === '' ? undefined : Number(position),
        is_published: isPublished,
        patterns: selectedPatterns.map((p) => p.id),
      };

      if (isEdit) {
        await updateSet.mutateAsync({ id: props.setId, payload });
        enqueueSnackbar(`Set "${title}" updated.`, { variant: 'success' });
      } else {
        await createSet.mutateAsync(payload);
        enqueueSnackbar(`Set "${title}" created.`, { variant: 'success' });
      }

      props.onSaved();
      handleClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      enqueueSnackbar(`Failed to save set: ${msg}`, { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {!isEdit && (
        <Button variant="contained" color="success" startIcon={<AddRoundedIcon />} onClick={() => setOpen(true)}>
          New Set
        </Button>
      )}

      <Dialog open={dialogOpen} onClose={() => !saving && handleClose()} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{isEdit ? 'Edit Set' : 'Create Set'}</DialogTitle>
        <Divider />
        <Box component="form" onSubmit={handleSubmit}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2.5 }}>
            {/* Basic info row */}
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
              <TextField
                label="Display order (position)"
                value={position}
                onChange={(e) => setPosition(e.target.value === '' ? '' : Number(e.target.value))}
                type="number"
                variant="filled"
                helperText="Lower numbers appear first"
                sx={{ minWidth: 200 }}
              />
            </Stack>

            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              variant="filled"
              multiline
              rows={2}
              helperText="Brief summary shown on the public sets page"
            />

            {/* Accent color */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                Accent color
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                {ACCENT_COLORS.map((c) => (
                  <Tooltip key={c.value} title={c.label}>
                    <Box
                      onClick={() => setColor(c.value)}
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        bgcolor: c.value || 'action.disabledBackground',
                        border: '2px solid',
                        borderColor: color === c.value ? 'text.primary' : 'transparent',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s',
                        '&:hover': { borderColor: 'text.secondary' },
                      }}
                    />
                  </Tooltip>
                ))}
              </Stack>
            </Box>

            {/* Publish toggle */}
            <FormControlLabel
              control={
                <Switch checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} color="success" />
              }
              label={
                <Stack>
                  <Typography variant="body2" fontWeight={600}>
                    {isPublished ? 'Published' : 'Draft'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {isPublished
                      ? 'Visible to everyone on the public Sets page'
                      : 'Only visible to admins — not shown publicly'}
                  </Typography>
                </Stack>
              }
            />

            <Divider />

            {/* Pattern picker */}
            <PatternPicker selected={selectedPatterns} onChange={setSelectedPatterns} />
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
              disabled={!title.trim()}
              sx={{ borderRadius: 2, fontWeight: 700 }}
            >
              {isEdit ? 'Save Changes' : 'Create Set'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}

// ─── PatternPicker ────────────────────────────────────────────────────────────

type PatternPickerProps = {
  selected: Array<{ id: string; name: string }>;
  onChange: (next: Array<{ id: string; name: string }>) => void;
};

function PatternPicker({ selected, onChange }: PatternPickerProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  const { data: results, isFetching } = useQuerySearchPatternsForPicker(debouncedSearch);

  const selectedIds = new Set(selected.map((p) => p.id));

  function add(id: string, name: string) {
    if (!selectedIds.has(id)) {
      onChange([...selected, { id, name }]);
    }
  }

  function remove(id: string) {
    onChange(selected.filter((p) => p.id !== id));
  }

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} mb={1}>
        Patterns in set ({selected.length})
      </Typography>

      {selected.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ mb: 2, fontStyle: 'italic', height: 220 }}>
          No patterns added yet. Search below to add some.
        </Typography>
      ) : (
        <List
          dense
          disablePadding
          sx={{
            mb: 2,
            height: 220,
            overflowY: 'auto',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {selected.map((p) => (
            <ListItem
              key={p.id}
              secondaryAction={
                <IconButton edge="end" size="small" onClick={() => remove(p.id)} color="error">
                  <RemoveCircleOutlineRoundedIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemText
                primary={
                  <Typography fontSize={13} fontWeight={500}>
                    {p.name}
                  </Typography>
                }
                secondary={
                  <Typography fontSize={11} color="text.disabled" fontFamily="monospace">
                    {p.id}
                  </Typography>
                }
              />
            </ListItem>
          ))}
        </List>
      )}

      <Typography variant="subtitle2" fontWeight={700} mb={1}>
        Add patterns
      </Typography>

      <TextField
        size="small"
        placeholder="Search by name or description…"
        fullWidth
        variant="outlined"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              {isFetching ? <CircularProgress size={14} /> : <SearchRoundedIcon fontSize="small" />}
            </InputAdornment>
          ),
        }}
        sx={{ mb: 1 }}
      />

      {results && results.length > 0 ? (
        <List
          dense
          disablePadding
          sx={{ maxHeight: 220, overflowY: 'auto', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
        >
          {results.map((p) => {
            const alreadyAdded = selectedIds.has(p.id);
            return (
              <ListItem
                key={p.id}
                sx={{ opacity: alreadyAdded ? 0.5 : 1 }}
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => add(p.id, p.name)}
                    disabled={alreadyAdded}
                    color="success"
                  >
                    <AddCircleOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemAvatar sx={{ minWidth: 40 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 1,
                      backgroundImage: `url("${generatePbImage(p)}")`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      bgcolor: 'action.disabledBackground',
                    }}
                  />
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography fontSize={13} fontWeight={500}>
                      {p.name}
                      {alreadyAdded && (
                        <Chip
                          label="Added"
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ ml: 1, fontSize: '0.6rem', height: 16 }}
                        />
                      )}
                    </Typography>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      ) : (
        !isFetching &&
        debouncedSearch && (
          <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
            No patterns found for "{debouncedSearch}"
          </Typography>
        )
      )}
    </Box>
  );
}
