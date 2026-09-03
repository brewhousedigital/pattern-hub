import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { generateSEO } from '@/functions/utilities/seo';
import { pocketbase } from '@/functions/database/authentication-setup';
import { useQueryGetAllTagTypes, TAG_TYPES_QUERY_KEY, type TypeTagTypeRecord } from '@/functions/database/tags';
import { useAdminLogger } from '@/functions/database/admin-logs';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';

import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';

// ─── Route ────────────────────────────────────────────────────────────────────
//
// Tag Types. Every tag belongs to a Type; "General" (the default) is seeded once and
// never shown as a badge on the public Definition Page or in the tag
// manager's grid - this screen manages every type OTHER than that default.

export const Route = createFileRoute('/space-command/tag-types')({
  component: RouteComponent,
  head: ({ match }) => generateSEO('Tag Types - Admin', '', match.pathname),
});

// display_mode/input_normalize are plain text fields, not a fixed-option
// select - an admin can type any value straight from the edit dialog below,
// with no schema access needed. These are just the values this codebase's
// code currently recognizes, offered as freeSolo Autocomplete suggestions so
// the common cases are still one click, not a typo-prone free type every time.
const KNOWN_DISPLAY_MODES = ['standard', 'author', 'block'];
const KNOWN_INPUT_NORMALIZE = ['strip_dashes'];

function RouteComponent() {
  const queryClient = useQueryClient();
  const { data: tagTypes = [], isPending, isError, refetch } = useQueryGetAllTagTypes();

  const [editing, setEditing] = useState<TypeTagTypeRecord | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TypeTagTypeRecord | null>(null);

  const handleSaved = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: TAG_TYPES_QUERY_KEY });
  };

  const columns: GridColDef<TypeTagTypeRecord>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          sx={params.row.color ? { bgcolor: params.row.color, color: '#fff' } : undefined}
        />
      ),
    },
    { field: 'group_label', headerName: 'Group label', flex: 1 },
    { field: 'display_mode', headerName: 'Display mode', width: 130 },
    { field: 'input_normalize', headerName: 'Input normalize', width: 140 },
    {
      field: 'collapsible',
      headerName: 'Collapsible',
      width: 110,
      renderCell: (params) => (params.value ? 'Yes' : 'No'),
    },
    { field: 'sort_order', headerName: 'Sort', width: 80, align: 'right', headerAlign: 'right' },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      filterable: false,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => setEditing(params.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => setDeleteTarget(params.row)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <>
      <AdminHeaderContainer
        title="Tag Types"
        subtitle={
          <Typography variant="body2" color="text.secondary">
            Types group and style tags for display - assign one to a tag from the Tag Management screen.
          </Typography>
        }
      />

      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>
          Add Type
        </Button>
      </Box>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load tag types. Check your PocketBase connection.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ height: 520 }}>
        <DataGrid loading={isPending} rows={tagTypes} columns={columns} getRowId={(row) => row.id} disableRowSelectionOnClick />
      </Paper>

      <TagTypeEditDialog
        open={!!editing}
        record={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
      />

      <DeleteTagTypeDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={handleSaved} />
    </>
  );
}

// ─── Edit Dialog ────────────────────────────────────────────────────────────────

interface TagTypeEditDialogProps {
  open: boolean;
  /** null means "create a new type." */
  record: TypeTagTypeRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

function TagTypeEditDialog({ open, record, onClose, onSaved }: TagTypeEditDialogProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [groupLabel, setGroupLabel] = useState('');
  const [collapsible, setCollapsible] = useState(true);
  const [displayMode, setDisplayMode] = useState('');
  const [inputNormalize, setInputNormalize] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { log } = useAdminLogger();

  useEffect(() => {
    if (open) {
      setName(record?.name ?? '');
      setColor(record?.color ?? '');
      setGroupLabel(record?.group_label ?? '');
      setCollapsible(record?.collapsible ?? true);
      setDisplayMode(record?.display_mode ?? '');
      setInputNormalize(record?.input_normalize ?? '');
      setSortOrder(record?.sort_order != null ? String(record.sort_order) : '');
      setError(null);
    }
  }, [open, record]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        color,
        group_label: groupLabel,
        collapsible,
        display_mode: displayMode,
        input_normalize: inputNormalize,
        sort_order: sortOrder ? Number(sortOrder) : 0,
      };

      if (record) {
        await pocketbase.collection('tag_types').update(record.id, payload);
      } else {
        await pocketbase.collection('tag_types').create(payload);
      }

      log({
        action: record ? 'Tag Type Updated' : 'Tag Type Created',
        entity_type: 'Tag Type',
        entity_id: record?.id ?? name.trim(),
        entity_name: name.trim(),
        changes: {
          name: { from: record?.name ?? null, to: payload.name },
          color: { from: record?.color ?? null, to: payload.color },
          group_label: { from: record?.group_label ?? null, to: payload.group_label },
          collapsible: { from: record?.collapsible ?? null, to: payload.collapsible },
          display_mode: { from: record?.display_mode ?? null, to: payload.display_mode },
          input_normalize: { from: record?.input_normalize ?? null, to: payload.input_normalize },
          sort_order: { from: record?.sort_order ?? null, to: payload.sort_order },
        },
        metadata: {},
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{record ? `Edit "${record.name}"` : 'Add Tag Type'}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} size="small" required autoFocus />
          <TextField
            label="Color"
            placeholder="#C8A96E, or any CSS color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            size="small"
          />
          <TextField
            label="Group label"
            placeholder="How this type's tags are grouped in the sidebar"
            value={groupLabel}
            onChange={(e) => setGroupLabel(e.target.value)}
            size="small"
          />
          <Autocomplete
            freeSolo
            options={KNOWN_DISPLAY_MODES}
            value={displayMode}
            onInputChange={(_, v) => setDisplayMode(v)}
            renderInput={(params) => (
              <TextField {...params} label="Display mode" size="small" placeholder="standard" />
            )}
          />
          <Autocomplete
            freeSolo
            options={KNOWN_INPUT_NORMALIZE}
            value={inputNormalize}
            onInputChange={(_, v) => setInputNormalize(v)}
            renderInput={(params) => (
              <TextField {...params} label="Input normalize" size="small" placeholder="(none)" />
            )}
          />
          <TextField
            label="Sort order"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            size="small"
          />
          <FormControlLabel
            control={<Checkbox checked={collapsible} onChange={(e) => setCollapsible(e.target.checked)} />}
            label="Collapsible in the sidebar"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" loading={saving}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Delete Confirmation ────────────────────────────────────────────────────────

interface DeleteTagTypeDialogProps {
  target: TypeTagTypeRecord | null;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteTagTypeDialog({ target, onClose, onDeleted }: DeleteTagTypeDialogProps) {
  const [usageCount, setUsageCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { log } = useAdminLogger();

  // Deleting a Type doesn't cascade-delete the tags that use it - PocketBase
  // just clears their `type` relation back to empty (General). This is a
  // safe operation either way, but worth telling the admin how many tags
  // are affected before they confirm.
  useEffect(() => {
    if (!target) {
      setUsageCount(null);
      return;
    }
    setError(null);
    pocketbase
      .collection('tags_v2')
      .getList(1, 1, { filter: `type = "${target.id}"` })
      .then((res) => setUsageCount(res.totalItems))
      .catch(() => setUsageCount(null));
  }, [target]);

  const handleDelete = async () => {
    if (!target) return;
    setDeleting(true);
    setError(null);
    try {
      await pocketbase.collection('tag_types').delete(target.id);
      log({
        action: 'Tag Type Deleted',
        entity_type: 'Tag Type',
        entity_id: target.id,
        entity_name: target.name,
        changes: {},
        metadata: { tags_affected: usageCount ?? 0 },
      });
      onDeleted();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={!!target} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="error" fontSize="small" />
        Delete "{target?.name}"?
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {usageCount !== null && usageCount > 0 && (
          <Alert severity="warning">
            {usageCount} tag{usageCount === 1 ? '' : 's'} currently use this type. They will fall back to General,
            not be deleted themselves.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleDelete} variant="contained" color="error" loading={deleting}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
