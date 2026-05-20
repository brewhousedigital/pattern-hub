import { useState, useCallback, useMemo, useEffect } from 'react';
import { pocketbase } from '@/functions/database/authentication-setup';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo';
import { useAtom, atom } from 'jotai';
import {
  useQueryAdminTagStats,
  useQueryAdminTagStatsPaginated,
  ADMIN_TAG_STATS_QUERY_KEY,
  ADMIN_TAG_STATS_PAGINATED_QUERY_KEY,
  type TypeTagStat,
  type TypePatternRecord,
} from '@/functions/database/tags';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

import SearchIcon from '@mui/icons-material/Search';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MergeIcon from '@mui/icons-material/Merge';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';

import {
  Box,
  Typography,
  TextField,
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  LinearProgress,
  InputAdornment,
  Tooltip,
  IconButton,
  Tabs,
  Tab,
  Checkbox,
  Snackbar,
  Divider,
} from '@mui/material';
import { DataGrid, type GridColDef, type GridSortModel } from '@mui/x-data-grid';

export const Route = createFileRoute('/space-command/tags')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Tags - Admin', '', match.pathname),
  }),
});

const globalIsFetchingPatterns = atom(false);
const useGlobalIsFetchingPatterns = () => {
  const [isFetchingPatterns, setIsFetchingPatterns] = useAtom(globalIsFetchingPatterns);
  return { isFetchingPatterns, setIsFetchingPatterns };
};

function RouteComponent() {
  return <TagManagementPage />;
}

type OperationType = 'rename' | 'delete' | 'merge';

const BATCH_DELAY_MS = 3000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch ALL patterns that contain a specific tag.
 * PocketBase filter syntax for array fields: tags ~ "value"
 */
async function fetchPatternsWithTag(tag: string): Promise<TypePatternRecord[]> {
  const records: TypePatternRecord[] = [];
  let page = 1;
  const perPage = 500;

  while (true) {
    const result = await pocketbase
      .collection('patterns')
      .getList<TypePatternRecord>(page, perPage, { filter: `tags ~ "${tag}"`, fields: 'id,tags' });
    records.push(...result.items);
    if (records.length >= result.totalItems) break;
    page++;
  }

  return records;
}

/**
 * Process an array of records one at a time, awaiting each before starting
 * the next, with BATCH_DELAY_MS between calls.
 */
async function processSequentially<T>(
  items: T[],
  processOne: (item: T) => Promise<void>,
  onProgress: (completed: number, total: number) => void,
) {
  for (let i = 0; i < items.length; i++) {
    await processOne(items[i]);
    onProgress(i + 1, items.length);
    if (i < items.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }
}

interface ProgressDialogProps {
  open: boolean;
  title: string;
  completed: number;
  total: number;
  done: boolean;
  error?: string;
  onClose: () => void;
}

function ProgressDialog({ open, title, completed, total, done, error, onClose }: ProgressDialogProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>

      <DialogContent>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : done ? (
          <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ mb: 2 }}>
            Operation complete — {completed} record{completed !== 1 ? 's' : ''} updated.
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Processing {completed} of {total} records…
            </Typography>

            <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4 }} />

            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {pct}% — records are sent one after the other to avoid overloading the server
            </Typography>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={!done && !error}>
          {done || error ? 'Close' : 'Running…'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  type: OperationType;
  tag: string;
  newTag?: string;
  affectedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const operationMeta: Record<OperationType, { color: 'error' | 'warning' | 'info'; verb: string }> = {
  delete: { color: 'error', verb: 'Delete' },
  rename: { color: 'warning', verb: 'Rename' },
  merge: { color: 'info', verb: 'Merge' },
};

function ConfirmDialog({ open, type, tag, newTag, affectedCount, onConfirm, onCancel }: ConfirmDialogProps) {
  const meta = operationMeta[type];

  const description = {
    delete: (
      <>
        Remove <strong>"{tag}"</strong> from {affectedCount} pattern
        {affectedCount !== 1 ? 's' : ''}. This cannot be undone.
      </>
    ),
    rename: (
      <>
        Rename <strong>"{tag}"</strong> → <strong>"{newTag}"</strong> across {affectedCount} pattern
        {affectedCount !== 1 ? 's' : ''}.
      </>
    ),
    merge: (
      <>
        Merge <strong>"{tag}"</strong> into <strong>"{newTag}"</strong> across {affectedCount} pattern
        {affectedCount !== 1 ? 's' : ''}. The old tag will be removed.
      </>
    ),
  }[type];

  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color={meta.color} />
        Confirm {meta.verb}
      </DialogTitle>

      <DialogContent>
        <Alert severity={meta.color} sx={{ mb: 0 }}>
          {description}
        </Alert>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>

        <Button onClick={onConfirm} variant="contained" color={meta.color} autoFocus>
          {meta.verb}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface RenameOrMergePanelProps {
  tagStats: TypeTagStat[];
  onRename: (from: string, to: string) => void;
  onMerge: (from: string, into: string) => void;
}

function RenameOrMergePanel({ tagStats, onRename, onMerge }: RenameOrMergePanelProps) {
  const [fromTag, setFromTag] = useState('');
  const [toTag, setToTag] = useState('');
  const [mode, setMode] = useState<'rename' | 'merge'>('rename');

  const { isFetchingPatterns } = useGlobalIsFetchingPatterns();

  const fromExists = tagStats.some((t) => t.tag === fromTag.trim());
  const toExists = tagStats.some((t) => t.tag === toTag.trim());

  const canSubmit = fromTag.trim() && toTag.trim() && fromTag.trim() !== toTag.trim() && fromExists;

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Tabs value={mode} onChange={(_, v) => setMode(v)} sx={{ mb: 3 }} textColor="primary" indicatorColor="primary">
        <Tab value="rename" label="Rename Tag" icon={<DriveFileRenameOutlineIcon />} iconPosition="start" />
        <Tab value="merge" label="Merge Tags" icon={<MergeIcon />} iconPosition="start" />
      </Tabs>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <TextField
          label={mode === 'rename' ? 'Current tag name' : 'Tag to absorb'}
          value={fromTag}
          onChange={(e) => setFromTag(e.target.value)}
          size="small"
          sx={{ flex: 1 }}
          error={fromTag.trim() !== '' && !fromExists}
          helperText={fromTag.trim() !== '' && !fromExists ? 'Tag not found' : ' '}
        />

        <Box sx={{ pt: 1, color: 'text.secondary', fontSize: 20 }}>{mode === 'rename' ? '→' : '⊂'}</Box>

        <TextField
          label={mode === 'rename' ? 'New tag name' : 'Target tag (keep this)'}
          value={toTag}
          onChange={(e) => setToTag(e.target.value)}
          size="small"
          sx={{ flex: 1 }}
          helperText={mode === 'merge' && toTag.trim() && !toExists ? 'This tag will be created' : ' '}
        />

        <Button
          loading={isFetchingPatterns}
          variant="contained"
          onClick={() => {
            if (mode === 'rename') onRename(fromTag.trim(), toTag.trim());
            else onMerge(fromTag.trim(), toTag.trim());
          }}
          disabled={!canSubmit}
          startIcon={mode === 'rename' ? <DriveFileRenameOutlineIcon /> : <MergeIcon />}
          sx={{ mt: 0.25 }}
        >
          {mode === 'rename' ? 'Rename' : 'Merge'}
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {mode === 'rename'
          ? 'Replaces the tag name across all patterns. The tag must already exist.'
          : 'Adds the target tag to all patterns that have the source tag, then removes the source tag.'}
      </Typography>
    </Paper>
  );
}

// Low-Use Cleanup Panel

interface CleanupPanelProps {
  tagStats: TypeTagStat[];
  onDeleteMany: (tags: string[]) => void;
}

function CleanupPanel({ tagStats, onDeleteMany }: CleanupPanelProps) {
  const { isFetchingPatterns } = useGlobalIsFetchingPatterns();

  const [threshold, setThreshold] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const candidates = tagStats.filter((t) => t.count <= threshold);

  const toggleAll = () => {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map((t) => t.tag)));
    }
  };

  const toggle = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(tag) ? next.delete(tag) : next.add(tag);
      return next;
    });
  };

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <CleaningServicesIcon color="action" />
        <Typography variant="subtitle1" fontWeight={600}>
          Low-Use Tag Cleanup
        </Typography>

        <Box sx={{ flex: 1 }} />

        <TextField
          label="Used ≤ N times"
          type="number"
          value={threshold}
          onChange={(e) => {
            setThreshold(Math.max(1, parseInt(e.target.value) || 1));
            setSelected(new Set());
          }}
          size="small"
          sx={{ width: 140 }}
          inputProps={{ min: 1 }}
        />
      </Box>

      {candidates.length === 0 ? (
        <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
          No tags found with ≤ {threshold} use{threshold !== 1 ? 's' : ''}. Your tag library is clean!
        </Alert>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 2 }}>
            Found <strong>{candidates.length}</strong> tag
            {candidates.length !== 1 ? 's' : ''} used {threshold} time
            {threshold !== 1 ? 's or fewer' : ''}.
          </Alert>

          <TableContainer sx={{ maxHeight: 260 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.size > 0 && selected.size < candidates.length}
                      checked={candidates.length > 0 && selected.size === candidates.length}
                      onChange={toggleAll}
                    />
                  </TableCell>
                  <TableCell>Tag</TableCell>
                  <TableCell align="right">Uses</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {candidates.map(({ tag, count }) => (
                  <TableRow
                    key={tag}
                    hover
                    onClick={() => toggle(tag)}
                    sx={{ cursor: 'pointer' }}
                    selected={selected.has(tag)}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox checked={selected.has(tag)} />
                    </TableCell>
                    <TableCell>
                      <Chip label={tag} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="text.secondary">
                        {count}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              loading={isFetchingPatterns}
              variant="contained"
              color="error"
              startIcon={<DeleteOutlineIcon />}
              disabled={selected.size === 0}
              onClick={() => onDeleteMany(Array.from(selected))}
            >
              Delete {selected.size} selected tag
              {selected.size !== 1 ? 's' : ''}
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
}

// Main Page

const TagManagementPage = () => {
  const queryClient = useQueryClient();

  // Full tag list — used by panels, header stats, and rename/merge validation.
  const { data: tagStats = [] } = useQueryAdminTagStats();

  const { setIsFetchingPatterns } = useGlobalIsFetchingPatterns();

  // ── All Tags table: server-side paginated search + sort ────────────────────
  const [tagSearch, setTagSearch] = useState('');
  const debouncedSearch = useDebounce(tagSearch, 400);
  const [tagPaginationModel, setTagPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [tagSortModel, setTagSortModel] = useState<GridSortModel>([{ field: 'count', sort: 'desc' }]);

  // Reset to first page whenever the search changes.
  useEffect(() => {
    setTagPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, [debouncedSearch]);

  const sortItem = tagSortModel[0];
  const {
    data: tagPageData,
    isFetching: tagPageFetching,
    error: tagPageError,
    refetch: refetchTagPage,
  } = useQueryAdminTagStatsPaginated({
    page: tagPaginationModel.page,
    pageSize: tagPaginationModel.pageSize,
    search: debouncedSearch,
    sortField: (sortItem?.field as 'tag' | 'count') ?? 'count',
    sortDir: (sortItem?.sort as 'asc' | 'desc') ?? 'desc',
  });

  // Operation state
  const [pendingOp, setPendingOp] = useState<{
    type: OperationType;
    tag: string;
    newTag?: string;
    affectedCount: number;
  } | null>(null);

  const [progress, setProgress] = useState<{
    open: boolean;
    title: string;
    completed: number;
    total: number;
    done: boolean;
    error?: string;
  }>({ open: false, title: '', completed: 0, total: 0, done: false });

  const [toast, setToast] = useState<string | null>(null);

  // Core operation executor
  const executeOperation = useCallback(
    async (op: { type: OperationType; tag: string; newTag?: string }) => {
      const { type, tag, newTag } = op;

      setProgress({
        open: true,
        title:
          type === 'delete'
            ? `Deleting tag "${tag}"…`
            : type === 'rename'
              ? `Renaming "${tag}" → "${newTag}"…`
              : `Merging "${tag}" → "${newTag}"…`,
        completed: 0,
        total: 0,
        done: false,
      });

      try {
        // Start the spinner
        setIsFetchingPatterns(true);

        const records = await fetchPatternsWithTag(tag);

        if (records.length === 0) {
          setProgress((p) => ({ ...p, done: true, total: 0, completed: 0 }));
          return;
        }

        setProgress((p) => ({ ...p, total: records.length }));

        await processSequentially(
          records,
          async (record) => {
            let updatedTags: string[];
            if (type === 'delete') {
              updatedTags = record.tags.filter((t) => t !== tag);
            } else {
              // rename or merge: replace the old tag with newTag
              // for merge: also ensure no duplicates if record already had newTag
              const without = record.tags.filter((t) => t !== tag);
              updatedTags = newTag && !without.includes(newTag) ? [...without, newTag] : without;
            }
            await pocketbase.collection('patterns').update(record.id, { tags: updatedTags });
            await sleep(BATCH_DELAY_MS);
          },
          (completed, total) => {
            setProgress((p) => ({ ...p, completed, total }));
          },
        );

        setProgress((p) => ({ ...p, done: true }));
        queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_PAGINATED_QUERY_KEY });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setProgress((p) => ({ ...p, error: msg }));
      }

      // Re-enable the button
      setIsFetchingPatterns(false);
    },
    [queryClient],
  );

  // Initiate operations (show preview count first)
  const startOp = useCallback(async (type: OperationType, tag: string, newTag?: string) => {
    setIsFetchingPatterns(true);

    const records = await fetchPatternsWithTag(tag);

    setPendingOp({ type, tag, newTag, affectedCount: records.length });

    setIsFetchingPatterns(false);
  }, []);

  const startDeleteMany = useCallback(async (tags: string[]) => {
    // For bulk cleanup, sum affected records — fetched one at a time
    let total = 0;

    setIsFetchingPatterns(true);

    for (const t of tags) {
      const records = await fetchPatternsWithTag(t);
      total += records.length;
      await sleep(BATCH_DELAY_MS);
    }

    setPendingOp({
      type: 'delete',
      tag: `${tags.length} tags`,
      affectedCount: total,
      newTag: undefined,
    });
    // Store tags for later execution
    (window as any).__pendingDeleteTags = tags;

    setIsFetchingPatterns(false);
  }, []);

  const confirmOp = useCallback(async () => {
    if (!pendingOp) return;
    const op = { ...pendingOp };
    setPendingOp(null);

    if (op.tag.endsWith(' tags') && (window as any).__pendingDeleteTags) {
      // Bulk cleanup path
      const tags: string[] = (window as any).__pendingDeleteTags;
      delete (window as any).__pendingDeleteTags;

      setProgress({
        open: true,
        title: `Deleting ${tags.length} tags…`,
        completed: 0,
        total: tags.length,
        done: false,
      });

      try {
        let completed = 0;
        for (const tag of tags) {
          const records = await fetchPatternsWithTag(tag);
          await processSequentially(
            records,
            async (r) => {
              await pocketbase.collection('patterns').update(r.id, {
                tags: r.tags.filter((t) => t !== tag),
              });
            },
            () => {},
          );

          await sleep(BATCH_DELAY_MS);

          completed++;
          setProgress((p) => ({ ...p, completed, total: tags.length }));
        }
        setProgress((p) => ({ ...p, done: true }));
        queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_PAGINATED_QUERY_KEY });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setProgress((p) => ({ ...p, error: msg }));
      }
    } else {
      await executeOperation({
        type: op.type,
        tag: op.tag,
        newTag: op.newTag,
      });
    }
  }, [pendingOp, executeOperation, queryClient]);

  const uniqueTagCount = tagStats.length;
  const totalTagUsages = tagStats.reduce((s, t) => s + t.count, 0);

  // ── All Tags DataGrid column definitions ──────────────────────────────────
  const tagColumns: GridColDef<TypeReadOnlyDatabaseItem>[] = [
    {
      field: 'tag',
      headerName: 'Tag',
      flex: 1,
      sortable: true,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          variant={params.row.count === 1 ? 'outlined' : 'filled'}
          color={params.row.count === 1 ? 'warning' : 'default'}
          sx={{ fontFamily: 'monospace' }}
        />
      ),
    },
    {
      field: 'count',
      headerName: 'Patterns',
      width: 110,
      sortable: true,
      disableColumnMenu: true,
      align: 'right',
      headerAlign: 'right',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 80,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => (
        <Tooltip title="Delete this tag globally">
          <IconButton size="small" onClick={() => startOp('delete', params.row.tag)} color="error">
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <>
      {/* Header */}
      <AdminHeaderContainer
        title="Tag Management"
        subtitle={
          <>
            <Typography variant="body2" color="text.secondary">
              Manage tags across all patterns. Operations are processed one after the other to protect server
              performance.
            </Typography>

            <Box sx={{ mt: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Chip
                label={`${uniqueTagCount.toLocaleString()} unique tags`}
                color="primary"
                variant="outlined"
                size="small"
              />
              <Chip label={`${totalTagUsages.toLocaleString()} total usages`} variant="outlined" size="small" />
              <Chip
                label={`${tagStats.filter((t) => t.count === 1).length} singleton tags`}
                color="warning"
                variant="outlined"
                size="small"
              />
            </Box>
          </>
        }
      />

      {/* Rename / Merge Panel */}
      <Box sx={{ mb: 3 }}>
        <RenameOrMergePanel
          tagStats={tagStats}
          onRename={(from, to) => startOp('rename', from, to)}
          onMerge={(from, into) => startOp('merge', from, into)}
        />
      </Box>

      {/* Cleanup Panel */}
      <Box sx={{ mb: 3 }}>
        <CleanupPanel tagStats={tagStats} onDeleteMany={startDeleteMany} />
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* All Tags — server-side paginated DataGrid */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }}>
          All Tags
        </Typography>

        <TextField
          placeholder="Search tags…"
          value={tagSearch}
          onChange={(e) => setTagSearch(e.target.value)}
          size="small"
          sx={{ width: 260 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />

        <Button size="small" onClick={() => refetchTagPage()} variant="outlined" color="inherit">
          Refresh
        </Button>
      </Box>

      {tagPageError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load tags. Check your PocketBase connection.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ height: 560 }}>
        <DataGrid
          loading={tagPageFetching}
          rows={tagPageData?.items ?? []}
          columns={tagColumns}
          rowCount={tagPageData?.totalItems ?? 0}
          paginationMode="server"
          sortingMode="server"
          filterMode="server"
          pagination
          paginationModel={tagPaginationModel}
          onPaginationModelChange={setTagPaginationModel}
          sortModel={tagSortModel}
          onSortModelChange={(model) => {
            setTagSortModel(model.length ? model : [{ field: 'count', sort: 'desc' }]);
            setTagPaginationModel((prev) => ({ ...prev, page: 0 }));
          }}
          pageSizeOptions={[25, 50, 100]}
          disableRowSelectionOnClick
          density="compact"
          sx={{ border: 'none' }}
        />
      </Paper>

      {/* Confirm Dialog */}
      {pendingOp && (
        <ConfirmDialog
          open={true}
          type={pendingOp.type}
          tag={pendingOp.tag}
          newTag={pendingOp.newTag}
          affectedCount={pendingOp.affectedCount}
          onConfirm={confirmOp}
          onCancel={() => setPendingOp(null)}
        />
      )}

      {/* Progress Dialog */}
      <ProgressDialog
        open={progress.open}
        title={progress.title}
        completed={progress.completed}
        total={progress.total}
        done={progress.done}
        error={progress.error}
        onClose={() =>
          setProgress({
            open: false,
            title: '',
            completed: 0,
            total: 0,
            done: false,
          })
        }
      />

      {/* Toast */}
      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
};
