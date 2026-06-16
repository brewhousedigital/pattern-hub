import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
  type DraggableAttributes,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useQueryGetKanbanColumns,
  useQueryGetAllKanbanItems,
  useMutationCreateColumn,
  useMutationUpdateColumn,
  useMutationDeleteColumn,
  useMutationUpdateItem,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  type TypeKanbanColumn,
  type TypeKanbanItem,
} from '@/functions/database/kanban';
import { KanbanItemModal } from '@/components/admin/KanbanItemModal';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { generateSEO } from '@/functions/utilities/seo';
import { enqueueSnackbar } from 'notistack';
import { useAdminLogger } from '@/functions/database/admin-logs';

import AddIcon from '@mui/icons-material/Add';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SettingsIcon from '@mui/icons-material/Settings';

import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/space-command/kanban')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Project Planning - Admin', '', match.pathname),
  }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compute a float position for an element inserted at `newIndex` in a sorted array. */
function midpoint(prev?: number, next?: number): number {
  if (prev == null && next == null) return 1000;
  if (prev == null) return (next ?? 1000) - 1;
  if (next == null) return prev + 1;
  return (prev + next) / 2;
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

// ─── Main route component ─────────────────────────────────────────────────────

function RouteComponent() {
  const { checkAccess } = useCheckAdminAccess();
  const canAdd = checkAccess(EnumLevelsAdmin.KANBAN_AC);
  const canEdit = checkAccess(EnumLevelsAdmin.KANBAN_AU);
  const canDelete = checkAccess(EnumLevelsAdmin.KANBAN_AD);

  // ── Server data ────────────────────────────────────────────────────────────
  const {
    data: rawColumns = [],
    isLoading: loadingCols,
    isError: errorCols,
    refetch: refetchColumns,
  } = useQueryGetKanbanColumns();
  const {
    data: rawItems = [],
    isLoading: loadingItems,
    isError: errorItems,
    refetch: refetchItems,
  } = useQueryGetAllKanbanItems();

  // ── Local state (for optimistic updates) ──────────────────────────────────
  const [columns, setColumns] = useState<TypeKanbanColumn[]>([]);
  const [items, setItems] = useState<TypeKanbanItem[]>([]);

  useEffect(() => {
    setColumns([...rawColumns].sort((a, b) => a.position - b.position));
  }, [rawColumns]);

  useEffect(() => {
    setItems(rawItems);
  }, [rawItems]);

  // ── Label filter ───────────────────────────────────────────────────────────
  const [labelFilter, setLabelFilter] = useState<Set<string>>(new Set());

  const allLabels = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      for (const label of item.labels ?? []) set.add(label);
    }
    return [...set].sort();
  }, [items]);

  function toggleLabel(label: string) {
    setLabelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  // ── Derived: items per column ──────────────────────────────────────────────
  const itemsByColumn = useMemo<Record<string, TypeKanbanItem[]>>(() => {
    const map: Record<string, TypeKanbanItem[]> = {};
    for (const col of columns) {
      let colItems = items.filter((i) => i.column_id === col.id);
      if (labelFilter.size > 0) {
        colItems = colItems.filter((i) => i.labels?.some((l) => labelFilter.has(l)));
      }
      if (col.is_done) {
        map[col.id] = [...colItems]
          .sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime())
          .slice(0, 5);
      } else {
        map[col.id] = [...colItems].sort((a, b) => a.position - b.position);
      }
    }
    return map;
  }, [columns, items, labelFilter]);

  // Unfiltered counts (for column header badge)
  const rawCountByColumn = useMemo(() => {
    const map: Record<string, number> = {};
    for (const col of columns) {
      map[col.id] = items.filter((i) => i.column_id === col.id).length;
    }
    return map;
  }, [columns, items]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createColumnMut = useMutationCreateColumn();
  const updateColumnMut = useMutationUpdateColumn();
  const deleteColumnMut = useMutationDeleteColumn();
  const updateItemMut = useMutationUpdateItem();
  const { log } = useAdminLogger();

  // ── Drag state ─────────────────────────────────────────────────────────────
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [loadingItemIds, setLoadingItemIds] = useState<Set<string>>(new Set());
  // Refs track column state during drag to avoid stale-closure bugs.
  // dragTargetColRef updates on every cross-column hover (handleDragOver).
  // dragOriginalColRef stays fixed at the column the item started in.
  const dragTargetColRef = useRef<string | null>(null);
  const dragOriginalColRef = useRef<string | null>(null);

  const activeDragType = activeDragId ? (columns.some((c) => c.id === activeDragId) ? 'column' : 'item') : null;
  const activeDragItem = activeDragType === 'item' ? (items.find((i) => i.id === activeDragId) ?? null) : null;
  const activeDragColumn = activeDragType === 'column' ? (columns.find((c) => c.id === activeDragId) ?? null) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart({ active }: DragStartEvent) {
    const activeIdStr = String(active.id);
    setActiveDragId(activeIdStr);
    const originalCol = items.find((i) => i.id === activeIdStr)?.column_id ?? null;
    dragTargetColRef.current = originalCol;
    dragOriginalColRef.current = originalCol;
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    if (activeIdStr === overIdStr) return;

    // Only move items cross-column here (not column reorder)
    const activeItem = items.find((i) => i.id === activeIdStr);
    if (!activeItem) return;

    const overColumn = columns.find((c) => c.id === overIdStr);
    const overItem = items.find((i) => i.id === overIdStr);
    const targetColId = overColumn?.id ?? overItem?.column_id;
    if (!targetColId || targetColId === activeItem.column_id) return;

    dragTargetColRef.current = targetColId;
    setItems((prev) => prev.map((i) => (i.id === activeIdStr ? { ...i, column_id: targetColId } : i)));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveDragId(null);
    const targetColId = dragTargetColRef.current;
    const originalColId = dragOriginalColRef.current;
    dragTargetColRef.current = null;
    dragOriginalColRef.current = null;

    const activeIdStr = String(active.id);
    const isCrossColumn = targetColId !== null && targetColId !== originalColId;

    // ── Column reorder - always needs a valid over target ──────────────────
    const isActiveColumn = columns.some((c) => c.id === activeIdStr);
    if (isActiveColumn) {
      if (!over || active.id === over.id) return;
      const overIdStr = String(over.id);
      if (!columns.some((c) => c.id === overIdStr)) return;
      const oldIdx = columns.findIndex((c) => c.id === activeIdStr);
      const newIdx = columns.findIndex((c) => c.id === overIdStr);
      if (oldIdx === newIdx) return;

      const reordered = arrayMove(columns, oldIdx, newIdx);
      const snapshot = [...columns];
      setColumns(reordered);

      const newPos = midpoint(reordered[newIdx - 1]?.position, reordered[newIdx + 1]?.position);
      updateColumnMut.mutate(
        { id: activeIdStr, position: newPos },
        {
          onSuccess: () => void refetchColumns(),
          onError: () => {
            setColumns(snapshot);
            enqueueSnackbar('Failed to reorder column.', { variant: 'error' });
          },
        },
      );
      return;
    }

    // ── Item move ──────────────────────────────────────────────────────────
    // For same-column reorders we need a valid over target; for cross-column
    // moves we proceed even if over is null (pointer-up outside droppable bounds
    // after handleDragOver already moved the card visually).
    if (!isCrossColumn && (!over || active.id === over.id)) return;

    const activeItem = items.find((i) => i.id === activeIdStr);
    if (!activeItem) return;

    const resolvedTargetColId = targetColId ?? activeItem.column_id;
    const overIdStr = over && String(over.id) !== activeIdStr ? String(over.id) : null;
    const colItems = items.filter((i) => i.column_id === resolvedTargetColId).sort((a, b) => a.position - b.position);

    const overItem = overIdStr ? colItems.find((i) => i.id === overIdStr) : undefined;

    let newPos: number;
    if (overItem) {
      const oldIdx = colItems.findIndex((i) => i.id === activeIdStr);
      const newIdx = colItems.findIndex((i) => i.id === overItem.id);
      const reordered = arrayMove(colItems, oldIdx, newIdx);
      const finalIdx = reordered.findIndex((i) => i.id === activeIdStr);
      newPos = midpoint(reordered[finalIdx - 1]?.position, reordered[finalIdx + 1]?.position);
    } else {
      // Dropped on empty column space - append to end
      const rest = colItems.filter((i) => i.id !== activeIdStr);
      newPos = (rest[rest.length - 1]?.position ?? 0) + 1;
    }

    const snapshot = [...items];
    setItems((prev) =>
      prev.map((i) => (i.id === activeIdStr ? { ...i, position: newPos, column_id: resolvedTargetColId } : i)),
    );
    setLoadingItemIds((prev) => new Set(prev).add(activeIdStr));

    updateItemMut.mutate(
      { id: activeIdStr, column_id: resolvedTargetColId, position: newPos },
      {
        onSuccess: () => {
          setLoadingItemIds((prev) => {
            const s = new Set(prev);
            s.delete(activeIdStr);
            return s;
          });
          void refetchItems();
        },
        onError: () => {
          setItems(snapshot);
          setLoadingItemIds((prev) => {
            const s = new Set(prev);
            s.delete(activeIdStr);
            return s;
          });
          enqueueSnackbar('Failed to move item.', { variant: 'error' });
        },
      },
    );
  }

  // ── Add column dialog ──────────────────────────────────────────────────────
  const [addColOpen, setAddColOpen] = useState(false);

  async function handleAddColumn(title: string) {
    const maxPos = columns[columns.length - 1]?.position ?? 0;
    const created = await createColumnMut.mutateAsync({ title, position: maxPos + 1 });
    log({
      action: 'Kanban Column Created',
      entity_type: 'Kanban Column',
      entity_id: created.id,
      entity_name: title,
      changes: {},
      metadata: {},
    });
    void refetchColumns();
    setAddColOpen(false);
  }

  // ── Edit column dialog ─────────────────────────────────────────────────────
  const [editColTarget, setEditColTarget] = useState<TypeKanbanColumn | null>(null);

  async function handleEditColumn(col: TypeKanbanColumn, patch: Partial<TypeKanbanColumn>) {
    await updateColumnMut.mutateAsync({ id: col.id, ...patch });
    log({
      action: 'Kanban Column Updated',
      entity_type: 'Kanban Column',
      entity_id: col.id,
      entity_name: patch.title ?? col.title,
      changes: Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, { from: (col as any)[k], to: v }])),
      metadata: {},
    });
    void refetchColumns();
    setEditColTarget(null);
  }

  // ── Delete column ──────────────────────────────────────────────────────────
  async function handleDeleteColumn(col: TypeKanbanColumn) {
    const count = rawCountByColumn[col.id] ?? 0;
    const msg =
      count > 0
        ? `Delete "${col.title}" and its ${count} item${count !== 1 ? 's' : ''}? This cannot be undone.`
        : `Delete column "${col.title}"? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    try {
      await deleteColumnMut.mutateAsync(col.id);
      log({
        action: 'Kanban Column Deleted',
        entity_type: 'Kanban Column',
        entity_id: col.id,
        entity_name: col.title,
        changes: {},
        metadata: { item_count: count },
      });
      void refetchColumns();
      void refetchItems();
      enqueueSnackbar('Column deleted.', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to delete column.', { variant: 'error' });
    }
  }

  // ── Item modal ─────────────────────────────────────────────────────────────
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemModalTarget, setItemModalTarget] = useState<TypeKanbanItem | null>(null);
  const [itemModalDefaultCol, setItemModalDefaultCol] = useState('');

  function openAddItem(columnId: string) {
    setItemModalTarget(null);
    setItemModalDefaultCol(columnId);
    setItemModalOpen(true);
  }

  function openEditItem(item: TypeKanbanItem) {
    setItemModalTarget(item);
    setItemModalDefaultCol(item.column_id);
    setItemModalOpen(true);
  }

  const handleItemSaved = useCallback(() => {
    void refetchItems();
  }, [refetchItems]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const isLoading = loadingCols || loadingItems;

  return (
    <>
      <AdminHeaderContainer
        title="Project Planning"
        subtitle={
          columns.length > 0 ? (
            <Typography variant="body2" color="text.secondary">
              {columns.length} column{columns.length !== 1 ? 's' : ''} · {items.length} item
              {items.length !== 1 ? 's' : ''}
            </Typography>
          ) : undefined
        }
        action={canAdd ? () => setAddColOpen(true) : undefined}
        actionText="Add Column"
        actionIcon={<AddIcon />}
        disabled={!canAdd}
      />

      {(errorCols || errorItems) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load board. Please refresh and try again.
        </Alert>
      )}

      {/* Label filter chips */}
      {allLabels.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 0.75 }}>
          <Chip
            label="All"
            size="small"
            variant={labelFilter.size === 0 ? 'filled' : 'outlined'}
            onClick={() => setLabelFilter(new Set())}
            color={labelFilter.size === 0 ? 'primary' : 'default'}
          />
          {allLabels.map((label) => (
            <Chip
              key={label}
              label={label}
              size="small"
              variant={labelFilter.has(label) ? 'filled' : 'outlined'}
              color={labelFilter.has(label) ? 'primary' : 'default'}
              onClick={() => toggleLabel(label)}
              sx={{ textTransform: 'capitalize' }}
            />
          ))}
        </Stack>
      )}

      {/* Board */}
      {isLoading ? (
        <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', pb: 2 }}>
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} variant="rounded" width={280} height={400} sx={{ flexShrink: 0, borderRadius: 3 }} />
          ))}
        </Stack>
      ) : columns.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 12,
            textAlign: 'center',
            color: 'text.disabled',
            gap: 2,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            No columns yet
          </Typography>
          <Typography variant="body2">Create your first column to start planning.</Typography>
          {canAdd && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddColOpen(true)} sx={{ mt: 1 }}>
              Add Column
            </Button>
          )}
        </Box>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                overflowX: 'auto',
                overflowY: 'visible',
                pb: 3,
                alignItems: 'flex-start',
                minHeight: 400,
              }}
            >
              {columns.map((col) => (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  items={itemsByColumn[col.id] ?? []}
                  rawCount={rawCountByColumn[col.id] ?? 0}
                  canAdd={canAdd}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  loadingItemIds={loadingItemIds}
                  onAddItem={openAddItem}
                  onEditItem={openEditItem}
                  onEditColumn={setEditColTarget}
                  onDeleteColumn={handleDeleteColumn}
                />
              ))}

              {/* Quick-add column button */}
              {canAdd && (
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => setAddColOpen(true)}
                  sx={{
                    flexShrink: 0,
                    height: 42,
                    minWidth: 160,
                    borderRadius: 3,
                    borderStyle: 'dashed',
                    alignSelf: 'flex-start',
                    mt: 0.5,
                    color: 'text.disabled',
                    borderColor: 'divider',
                    '&:hover': { borderColor: 'text.secondary', color: 'text.secondary' },
                  }}
                >
                  Add column
                </Button>
              )}
            </Box>
          </SortableContext>

          {/* Drag overlay */}
          <DragOverlay>
            {activeDragItem && <KanbanCardStatic item={activeDragItem} isLoading={false} onClick={() => {}} />}
            {activeDragColumn && (
              <KanbanColumnStatic
                column={activeDragColumn}
                items={itemsByColumn[activeDragColumn.id] ?? []}
                rawCount={rawCountByColumn[activeDragColumn.id] ?? 0}
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Add column dialog */}
      <AddColumnDialog
        open={addColOpen}
        onClose={() => setAddColOpen(false)}
        onAdd={handleAddColumn}
        loading={createColumnMut.isPending}
      />

      {/* Edit column dialog */}
      <EditColumnDialog
        open={!!editColTarget}
        column={editColTarget}
        onClose={() => setEditColTarget(null)}
        onSave={handleEditColumn}
        loading={updateColumnMut.isPending}
      />

      {/* Item modal */}
      <KanbanItemModal
        open={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        item={itemModalTarget}
        defaultColumnId={itemModalDefaultCol}
        columns={columns}
        canEdit={canEdit}
        canDelete={canDelete}
        onSaved={handleItemSaved}
      />
    </>
  );
}

// ─── KanbanColumn ─────────────────────────────────────────────────────────────

type KanbanColumnProps = {
  column: TypeKanbanColumn;
  items: TypeKanbanItem[];
  rawCount: number;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  loadingItemIds: Set<string>;
  onAddItem: (colId: string) => void;
  onEditItem: (item: TypeKanbanItem) => void;
  onEditColumn: (col: TypeKanbanColumn) => void;
  onDeleteColumn: (col: TypeKanbanColumn) => void;
};

function KanbanColumn({
  column,
  items,
  rawCount,
  canAdd,
  canEdit,
  canDelete,
  loadingItemIds,
  onAddItem,
  onEditItem,
  onEditColumn,
  onDeleteColumn,
}: KanbanColumnProps) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: column.id,
    data: { type: 'column', column },
  });

  const wipExceeded = column.wip_limit > 0 && rawCount > column.wip_limit;
  const wipAtLimit = column.wip_limit > 0 && rawCount === column.wip_limit;

  const accentColor = column.color || undefined;

  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <Box ref={setNodeRef} style={style} sx={{ flexShrink: 0, width: 280, display: 'flex', flexDirection: 'column' }}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 120,
          overflow: 'hidden',
        }}
      >
        {/* Column header */}
        <Box
          sx={{
            px: 1.5,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            backgroundColor: accentColor ? alpha(accentColor, 0.08) : 'grey.50',
            borderTop: accentColor ? `3px solid ${accentColor}` : '3px solid transparent',
          }}
        >
          {/* Drag handle */}
          <Tooltip title="Drag to reorder column" disableInteractive>
            <IconButton
              size="small"
              sx={{ cursor: 'grab', color: 'text.disabled', p: 0.25, '&:active': { cursor: 'grabbing' } }}
              {...attributes}
              {...listeners}
            >
              <DragIndicatorIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {/* Title + done badge */}
          <Stack direction="row" sx={{ alignItems: 'center', flex: 1, minWidth: 0 }} spacing={0.75}>
            {column.is_done && (
              <Tooltip title="Done column - shows last 5 items">
                <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main', flexShrink: 0 }} />
              </Tooltip>
            )}
            <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: accentColor || 'text.primary' }}>
              {column.title}
            </Typography>
          </Stack>

          {/* Item count badge */}
          <Chip
            label={rawCount}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              fontWeight: 700,
              backgroundColor: wipExceeded ? 'error.main' : wipAtLimit ? 'warning.main' : 'action.hover',
              color: wipExceeded || wipAtLimit ? 'white' : 'text.secondary',
              '.MuiChip-label': { px: 0.75 },
            }}
          />

          {/* Column menu */}
          {(canEdit || canDelete) && (
            <>
              <IconButton
                size="small"
                sx={{ p: 0.25, color: 'text.disabled' }}
                onClick={(e) => setMenuAnchor(e.currentTarget)}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
              <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
                {canEdit && (
                  <MenuItem
                    onClick={() => {
                      setMenuAnchor(null);
                      onEditColumn(column);
                    }}
                  >
                    <ListItemIcon>
                      <SettingsIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Settings</ListItemText>
                  </MenuItem>
                )}
                {canDelete && (
                  <MenuItem
                    onClick={() => {
                      setMenuAnchor(null);
                      onDeleteColumn(column);
                    }}
                    sx={{ color: 'error.main' }}
                  >
                    <ListItemIcon sx={{ color: 'error.main' }}>
                      <DeleteIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Delete</ListItemText>
                  </MenuItem>
                )}
              </Menu>
            </>
          )}
        </Box>

        {/* WIP warning */}
        {(wipExceeded || wipAtLimit) && (
          <Box
            sx={{ px: 1.5, py: 0.5, backgroundColor: wipExceeded ? alpha('#f44336', 0.08) : alpha('#ff9800', 0.08) }}
          >
            <Typography variant="caption" color={wipExceeded ? 'error.main' : 'warning.main'} sx={{ fontWeight: 600 }}>
              {wipExceeded ? `Over WIP limit (${column.wip_limit})` : `At WIP limit (${column.wip_limit})`}
            </Typography>
          </Box>
        )}

        {canAdd && !column.is_done && (
          <>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => onAddItem(column.id)}
              sx={{
                m: 1,
                mb: -0.25,
                py: 0.75,
                color: 'text.disabled',
                '&:hover': { color: 'text.primary', backgroundColor: 'action.hover' },
              }}
            >
              Add item
            </Button>
          </>
        )}

        {/* Items */}
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.75, flex: 1 }}>
            {items.map((item) => (
              <KanbanCard
                key={item.id}
                item={item}
                isLoading={loadingItemIds.has(item.id)}
                onClick={() => onEditItem(item)}
                canEdit={canEdit}
              />
            ))}
            {items.length === 0 && (
              <Box sx={{ py: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                  {column.is_done ? 'No completed items' : 'No items'}
                </Typography>
              </Box>
            )}
          </Box>
        </SortableContext>

        {/* Done column note */}
        {column.is_done && rawCount > 5 && (
          <Box sx={{ px: 1.5, pb: 1 }}>
            <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
              Showing 5 most recently updated ({rawCount} total)
            </Typography>
          </Box>
        )}

        {/* Add item button */}
        {canAdd && !column.is_done && (
          <>
            <Divider />
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => onAddItem(column.id)}
              sx={{
                borderRadius: 0,
                borderBottomLeftRadius: 12,
                borderBottomRightRadius: 12,
                py: 0.75,
                color: 'text.disabled',
                '&:hover': { color: 'text.primary', backgroundColor: 'action.hover' },
              }}
            >
              Add item
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
}

// ─── KanbanCard ───────────────────────────────────────────────────────────────

type KanbanCardProps = {
  item: TypeKanbanItem;
  isLoading: boolean;
  onClick: () => void;
  canEdit?: boolean;
};

function KanbanCard({ item, isLoading, onClick }: KanbanCardProps) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: item.id,
    data: { type: 'item', item },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <Box ref={setNodeRef} style={style}>
      <KanbanCardStatic item={item} isLoading={isLoading} onClick={onClick} dragProps={{ attributes, listeners }} />
    </Box>
  );
}

// ─── KanbanCardStatic (shared between KanbanCard and DragOverlay) ─────────────

type KanbanCardStaticProps = {
  item: TypeKanbanItem;
  isLoading: boolean;
  onClick: () => void;
  //dragProps?: { attributes: Record<string, unknown>; listeners: Record<string, unknown> | undefined };
  dragProps?: { attributes: DraggableAttributes; listeners: Record<string, unknown> | undefined };
};

function KanbanCardStatic({ item, isLoading, onClick, dragProps }: KanbanCardStaticProps) {
  const priorityColor = PRIORITY_COLORS[item.priority ?? 'none'];
  const labels = Array.isArray(item.labels) ? item.labels : [];
  const isOverdue = item.due_date ? new Date(item.due_date) < new Date(new Date().toDateString()) : false;
  const isDueToday = item.due_date ? new Date(item.due_date).toDateString() === new Date().toDateString() : false;

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        cursor: 'pointer',
        borderLeft: `4px solid ${priorityColor}`,
        transition: 'box-shadow 0.15s, border-color 0.15s',
        '&:hover': { boxShadow: 2 },
        overflow: 'hidden',
      }}
      onClick={onClick}
    >
      <Box sx={{ p: 1.25 }}>
        {/* Drag handle row */}
        {dragProps && (
          <Box
            sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.25, mx: -0.5 }}
            onClick={(e) => e.stopPropagation()}
          >
            <IconButton
              size="small"
              sx={{ cursor: 'grab', color: 'text.disabled', p: 0.25, '&:active': { cursor: 'grabbing' } }}
              {...dragProps.attributes}
              {...(dragProps.listeners as Record<string, unknown>)}
            >
              <DragIndicatorIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        )}

        {/* Title */}
        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.35, mb: labels.length > 0 ? 0.75 : 0.5 }}>
          {item.title}
        </Typography>

        {/* Labels */}
        {labels.length > 0 && (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.4, mb: 0.75 }}>
            {labels.map((l) => (
              <Chip
                key={l}
                label={l}
                size="small"
                variant="outlined"
                sx={{ height: 16, fontSize: '0.6rem', textTransform: 'capitalize', '.MuiChip-label': { px: 0.6 } }}
              />
            ))}
          </Stack>
        )}

        {/* Bottom row */}
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }} spacing={0.5}>
          {item.due_date ? (
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: isOverdue ? 'error.main' : isDueToday ? 'warning.main' : 'text.disabled',
                fontSize: '0.65rem',
              }}
            >
              {isOverdue ? '⚠ ' : ''}
              {new Date(item.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Typography>
          ) : (
            <Box />
          )}

          <Stack direction="row" sx={{ alignItems: 'center' }} spacing={0.5}>
            {item.assignee && (
              <Tooltip title={item.assignee} disableInteractive>
                <Avatar sx={{ width: 18, height: 18, fontSize: '0.55rem', backgroundColor: 'primary.main' }}>
                  {initialsOf(item.assignee)}
                </Avatar>
              </Tooltip>
            )}
            {item.priority !== 'none' && (
              <Tooltip title={`Priority: ${PRIORITY_LABELS[item.priority ?? 'none']}`} disableInteractive>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: priorityColor, flexShrink: 0 }} />
              </Tooltip>
            )}
            {isLoading && <CircularProgress size={12} thickness={5} />}
          </Stack>
        </Stack>
      </Box>
    </Paper>
  );
}

// ─── KanbanColumnStatic (used in DragOverlay) ─────────────────────────────────

type KanbanColumnStaticProps = {
  column: TypeKanbanColumn;
  items: TypeKanbanItem[];
  rawCount: number;
};

function KanbanColumnStatic({ column, items, rawCount }: KanbanColumnStaticProps) {
  const accentColor = column.color || undefined;
  return (
    <Box sx={{ flexShrink: 0, width: 280, opacity: 0.9 }}>
      <Paper
        elevation={4}
        sx={{
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          borderTop: accentColor ? `3px solid ${accentColor}` : '3px solid transparent',
        }}
      >
        <Box
          sx={{
            px: 1.5,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            borderBottom: '1px solid',
            borderColor: 'divider',
            backgroundColor: accentColor ? alpha(accentColor, 0.08) : 'grey.50',
          }}
        >
          <DragIndicatorIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
          <Typography variant="body2" noWrap sx={{ fontWeight: 700, flex: 1, color: accentColor || 'text.primary' }}>
            {column.title}
          </Typography>
          <Chip
            label={rawCount}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              fontWeight: 700,
              backgroundColor: 'action.hover',
              '.MuiChip-label': { px: 0.75 },
            }}
          />
        </Box>
        <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {items.slice(0, 3).map((item) => (
            <KanbanCardStatic key={item.id} item={item} isLoading={false} onClick={() => {}} />
          ))}
          {items.length > 3 && (
            <Typography variant="caption" color="text.disabled" sx={{ px: 1 }}>
              +{items.length - 3} more
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

// ─── AddColumnDialog ──────────────────────────────────────────────────────────

type AddColumnDialogProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (title: string) => Promise<void>;
  loading: boolean;
};

function AddColumnDialog({ open, onClose, onAdd, loading }: AddColumnDialogProps) {
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (open) setTitle('');
  }, [open]);

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await onAdd(title.trim());
      enqueueSnackbar('Column created.', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to create column.', { variant: 'error' });
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Add Column</DialogTitle>
      <Divider />
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 2.5 }}>
          <TextField
            label="Column title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            fullWidth
            variant="filled"
            autoFocus
            placeholder='e.g. "Backlog", "In Progress", "Done"'
          />
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2 }} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={loading} disabled={!title.trim()} sx={{ borderRadius: 2 }}>
            Create
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

// ─── EditColumnDialog ─────────────────────────────────────────────────────────

type EditColumnDialogProps = {
  open: boolean;
  column: TypeKanbanColumn | null;
  onClose: () => void;
  onSave: (col: TypeKanbanColumn, patch: Partial<TypeKanbanColumn>) => Promise<void>;
  loading: boolean;
};

function EditColumnDialog({ open, column, onClose, onSave, loading }: EditColumnDialogProps) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState('');
  const [wipLimit, setWipLimit] = useState('');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (column) {
      setTitle(column.title ?? '');
      setColor(column.color ?? '');
      setWipLimit(column.wip_limit ? String(column.wip_limit) : '');
      setIsDone(column.is_done ?? false);
    }
  }, [column]);

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    if (!column || !title.trim()) return;
    try {
      await onSave(column, {
        title: title.trim(),
        color: color.trim() || '',
        wip_limit: wipLimit ? parseInt(wipLimit, 10) : 0,
        is_done: isDone,
      });
      enqueueSnackbar('Column updated.', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to update column.', { variant: 'error' });
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon fontSize="small" sx={{ color: 'text.disabled' }} />
        Column Settings
      </DialogTitle>
      <Divider />
      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2.5 }}>
          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            fullWidth
            variant="filled"
            autoFocus
          />

          {/* Accent color */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              Accent color
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              {['#4caf50', '#2196f3', '#ff9800', '#f44336', '#9c27b0', '#00bcd4', ''].map((preset) => (
                <Tooltip key={preset || 'none'} title={preset || 'None'} disableInteractive>
                  <Box
                    onClick={() => setColor(preset)}
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      backgroundColor: preset || 'action.disabledBackground',
                      border: color === preset ? '2px solid' : '1px solid',
                      borderColor: color === preset ? 'text.primary' : 'divider',
                      cursor: 'pointer',
                      transition: 'transform 0.1s',
                      '&:hover': { transform: 'scale(1.2)' },
                    }}
                  />
                </Tooltip>
              ))}
              {/* Custom hex input */}
              <Tooltip title="Custom color" disableInteractive>
                <Box
                  component="input"
                  type="color"
                  value={color || '#ffffff'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setColor(e.target.value)}
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    border: '1px solid',
                    borderColor: 'divider',
                    cursor: 'pointer',
                    padding: 0,
                    overflow: 'hidden',
                  }}
                />
              </Tooltip>
            </Stack>
          </Box>

          <TextField
            label="WIP limit (0 = unlimited)"
            value={wipLimit}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '' || /^\d+$/.test(v)) setWipLimit(v);
            }}
            fullWidth
            variant="filled"
            type="number"
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
            helperText="Column header turns amber at limit, red when exceeded."
          />

          <FormControlLabel
            control={<Checkbox checked={isDone} onChange={(e) => setIsDone(e.target.checked)} />}
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Done column
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  Shows only the 5 most recently completed items.
                </Typography>
              </Box>
            }
          />
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2 }} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={loading} disabled={!title.trim()} sx={{ borderRadius: 2 }}>
            Save
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
