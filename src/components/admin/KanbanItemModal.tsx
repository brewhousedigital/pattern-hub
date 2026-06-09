import React, { useState, useEffect } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { enqueueSnackbar } from 'notistack';
import { useQueryClient } from '@tanstack/react-query';
import {
  type TypeKanbanItem,
  type TypeKanbanColumn,
  type TypeKanbanPriority,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  KANBAN_ITEMS_QUERY_KEY,
  useMutationCreateItem,
  useMutationUpdateItem,
  useMutationDeleteItem,
} from '@/functions/database/kanban';
import { GenericMarkdownEditor } from '@/components/admin/GenericMarkdownEditor';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';

import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

import {
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

// ─── Constants ────────────────────────────────────────────────────────────────

const LABEL_SUGGESTIONS = [
  'backlog',
  'bug',
  'feature',
  'improvement',
  'blocked',
  'needs',
  'review',
  'urgent',
  'research',
  'design',
];

const PRIORITY_OPTIONS: TypeKanbanPriority[] = ['none', 'low', 'high'];

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
  /** Null = create mode. */
  item: TypeKanbanItem | null;
  /** Pre-selected column when creating. */
  defaultColumnId: string;
  columns: TypeKanbanColumn[];
  canEdit: boolean;
  canDelete: boolean;
  /** Called after a successful save or delete so the board can refresh. */
  onSaved: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const KanbanItemModal = ({
  open,
  onClose,
  item,
  defaultColumnId,
  columns,
  canEdit,
  canDelete,
  onSaved,
}: Props) => {
  const queryClient = useQueryClient();
  const isCreate = !item?.id;

  // Edit vs. view mode (view mode only when editing an existing item)
  const [editMode, setEditMode] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [labelsInput, setLabelsInput] = useState('');
  const [priority, setPriority] = useState<TypeKanbanPriority>('none');
  const [dueDate, setDueDate] = useState<Dayjs | null>(null);
  const [assignee, setAssignee] = useState('');
  const [columnId, setColumnId] = useState('');
  const [saving, setSaving] = useState(false);

  const createItem = useMutationCreateItem();
  const updateItem = useMutationUpdateItem();
  const deleteItem = useMutationDeleteItem();

  // Populate form when the modal opens
  useEffect(() => {
    if (!open) return;
    if (item) {
      setTitle(item.title ?? '');
      setDescription(item.description ?? '');
      setLabels(Array.isArray(item.labels) ? item.labels : []);
      setPriority((item.priority as TypeKanbanPriority) ?? 'none');
      setDueDate(item.due_date ? dayjs(item.due_date) : null);
      setAssignee(item.assignee ?? '');
      setColumnId(item.column_id ?? defaultColumnId);
      setEditMode(false); // open in view mode when editing
    } else {
      setTitle('');
      setDescription('');
      setLabels([]);
      setPriority('none');
      setDueDate(null);
      setAssignee('');
      setColumnId(defaultColumnId);
      setEditMode(true); // open in edit mode when creating
    }
    setLabelsInput('');
    setSaving(false);
  }, [item, open, defaultColumnId]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: KANBAN_ITEMS_QUERY_KEY });
    onSaved();
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        labels,
        priority,
        due_date: dueDate ? dueDate.format('YYYY-MM-DD') : '',
        assignee: assignee.trim(),
        column_id: columnId,
      };

      if (isCreate) {
        // Position = max position in column + 1 (server will correct on next fetch)
        await createItem.mutateAsync({ ...payload, position: Date.now() });
        enqueueSnackbar('Item created.', { variant: 'success' });
      } else {
        await updateItem.mutateAsync({ id: item!.id, ...payload });
        enqueueSnackbar('Item saved.', { variant: 'success' });
      }

      invalidate();
      onClose();
    } catch {
      enqueueSnackbar('Failed to save. Please try again.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item || !window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await deleteItem.mutateAsync(item.id);
      enqueueSnackbar('Item deleted.', { variant: 'success' });
      invalidate();
      onClose();
    } catch {
      enqueueSnackbar('Failed to delete. Please try again.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  const isOverdue = dueDate ? dueDate.isBefore(dayjs(), 'day') : false;

  // ── View mode ──────────────────────────────────────────────────────────────
  const viewContent = (
    <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Meta row */}
      <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap' }}>
        {dueDate && (
          <Box>
            <Typography variant="caption" color="text.disabled" display="block">
              Due
            </Typography>
            <Typography variant="body2" fontWeight={600} color={isOverdue ? 'error.main' : 'text.primary'}>
              {dueDate.format('MMM D, YYYY')}
              {isOverdue && ' (overdue)'}
            </Typography>
          </Box>
        )}
        {assignee && (
          <Box>
            <Typography variant="caption" color="text.disabled" display="block">
              Assignee
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {assignee}
            </Typography>
          </Box>
        )}
        {columnId && (
          <Box>
            <Typography variant="caption" color="text.disabled" display="block">
              Column
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {columns.find((c) => c.id === columnId)?.title ?? '—'}
            </Typography>
          </Box>
        )}
      </Stack>

      {/* Description */}
      {description.trim() ? (
        <Box
          sx={{
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            p: 2,
            fontSize: 14,
            lineHeight: 1.7,
            '& h1,h2,h3,h4': { fontWeight: 500, mt: 1.5, mb: 0.5 },
            '& ul,ol': { pl: 2.5 },
            '& code': {
              fontFamily: 'monospace',
              backgroundColor: 'grey.100',
              px: 0.5,
              borderRadius: 0.5,
              fontSize: '0.9em',
            },
            '& a': { color: 'primary.main' },
          }}
        >
          <MarkdownWrapper>{description}</MarkdownWrapper>
        </Box>
      ) : (
        <Typography variant="body2" color="text.disabled" fontStyle="italic">
          No description.
        </Typography>
      )}
    </DialogContent>
  );

  // ── Edit mode ──────────────────────────────────────────────────────────────
  const editContent = (
    <Box component="form" onSubmit={handleSave}>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2.5 }}>
        {/* Title */}
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          fullWidth
          variant="filled"
          autoFocus={isCreate}
        />

        {/* Priority + Assignee row */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl variant="filled" sx={{ flex: 1 }}>
            <InputLabel>Priority</InputLabel>
            <Select value={priority} onChange={(e) => setPriority(e.target.value as TypeKanbanPriority)}>
              {PRIORITY_OPTIONS.map((p) => (
                <MenuItem key={p} value={p}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: PRIORITY_COLORS[p],
                        flexShrink: 0,
                      }}
                    />
                    <span>{PRIORITY_LABELS[p]}</span>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            variant="filled"
            sx={{ flex: 1 }}
            placeholder="Name or initials"
          />
        </Stack>

        {/* Due Date + Column row */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <DatePicker
            label="Due Date"
            value={dueDate}
            onChange={(v) => setDueDate(v)}
            slotProps={{ textField: { variant: 'filled', size: 'medium', fullWidth: true, sx: { flex: 1 } } }}
          />

          <FormControl variant="filled" sx={{ flex: 1 }}>
            <InputLabel>Column</InputLabel>
            <Select value={columnId} onChange={(e) => setColumnId(e.target.value)}>
              {columns.map((col) => (
                <MenuItem key={col.id} value={col.id}>
                  {col.title}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {/* Labels */}
        <Autocomplete
          multiple
          freeSolo
          options={LABEL_SUGGESTIONS}
          value={labels}
          onChange={(_, v) => setLabels(v as string[])}
          inputValue={labelsInput}
          onInputChange={(_, v) => setLabelsInput(v)}
          renderTags={(value, getTagProps) =>
            value.map((option, idx) => {
              const { key, ...props } = getTagProps({ index: idx });
              return <Chip key={key} label={option} size="small" {...props} />;
            })
          }
          renderInput={(params) => (
            <TextField {...params} variant="filled" label="Labels" placeholder="Type a label and press Enter" />
          )}
        />

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          Tips on writing good feature specifications:{' '}
          <a
            href="https://remimercier.com/how-to-write-better-specifications/"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://remimercier.com/how-to-write-better-specifications/
          </a>
        </Typography>

        {/* Description */}
        <GenericMarkdownEditor content={description} setContent={setDescription} characterLimit={5000} />
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        {!isCreate && canDelete && (
          <Tooltip title="Delete this item">
            <Box component="span" sx={{ mr: 'auto' }}>
              <Button
                color="error"
                variant="outlined"
                startIcon={<DeleteIcon />}
                onClick={handleDelete}
                disabled={saving}
                sx={{ borderRadius: 2 }}
              >
                Delete
              </Button>
            </Box>
          </Tooltip>
        )}
        <Button
          onClick={isCreate ? onClose : () => setEditMode(false)}
          variant="outlined"
          sx={{ borderRadius: 2 }}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          loading={saving}
          disabled={!title.trim()}
          sx={{ borderRadius: 2, fontWeight: 700 }}
        >
          {isCreate ? 'Create' : 'Save'}
        </Button>
      </DialogActions>
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <span style={{ display: 'block' }}>
            {isCreate ? 'New Item' : editMode ? 'Edit Item' : (item?.title ?? 'Item')}
          </span>

          <Stack direction="row" sx={{ gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {!isCreate && !editMode && (
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                Priority: {PRIORITY_LABELS[priority]}
              </Typography>
            )}

            {/* Labels */}
            {labels.length > 0 && (
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {labels.map((l) => (
                  <Chip
                    key={l}
                    label={l}
                    size="small"
                    variant="outlined"
                    sx={{ textTransform: 'capitalize', fontSize: '0.7rem' }}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        </Box>

        {!isCreate && !editMode && canEdit && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setEditMode(true)}
            sx={{ borderRadius: 2, fontWeight: 600 }}
          >
            Edit
          </Button>
        )}
      </DialogTitle>

      <Divider />

      {editMode ? editContent : viewContent}

      {/* View mode footer */}
      {!editMode && (
        <>
          <Divider />
          <DialogActions sx={{ px: 3, py: 2 }}>
            {canDelete && !isCreate && (
              <Tooltip title="Delete this item">
                <Box component="span" sx={{ mr: 'auto' }}>
                  <Button
                    color="error"
                    variant="outlined"
                    startIcon={<DeleteIcon />}
                    onClick={handleDelete}
                    disabled={saving}
                    sx={{ borderRadius: 2 }}
                  >
                    Delete
                  </Button>
                </Box>
              </Tooltip>
            )}
            <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2 }}>
              Close
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};
