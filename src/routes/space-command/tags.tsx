import { useState, useCallback, useMemo, useEffect } from 'react';
import { pocketbase } from '@/functions/database/authentication-setup';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo';
import { useAtom, atom } from 'jotai';
import {
  useQueryAdminTagStats,
  useQueryAdminTagStatsPaginated,
  useQueryGetTagHierarchy,
  TAG_HIERARCHY_QUERY_KEY,
  ADMIN_TAG_STATS_QUERY_KEY,
  ADMIN_TAG_STATS_PAGINATED_QUERY_KEY,
  setTagParent,
  clearTagParent,
  getAncestors,
  getDescendants,
  type TypeTagStat,
  type TypePatternRecord,
  type TypeTagHierarchyRecord,
} from '@/functions/database/tags';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

import SearchIcon from '@mui/icons-material/Search';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import MergeIcon from '@mui/icons-material/Merge';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ListIcon from '@mui/icons-material/List';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import SyncIcon from '@mui/icons-material/Sync';

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
  Collapse,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
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

// ─── Hierarchy updater ────────────────────────────────────────────────────────
//
// Always fetches fresh records from PocketBase so stale React Query cache
// can never cause a missed update. Called after pattern processing for every
// rename / merge / delete operation.
//
//   rename  - updates the tag's own name in its parent record and updates
//             every child's parent_tag reference to the new name.
//   merge   - removes the source tag's own parent record (it no longer exists)
//             and re-parents its children to the merge target.
//   delete  - removes the tag's own parent record and removes the parent
//             records of any children (they become root tags).

async function updateHierarchyForOp(type: OperationType, tag: string, newTag?: string) {
  const safe = tag.toLowerCase().trim();

  const [ownRecord, childRecords] = await Promise.all([
    pocketbase
      .collection('tag_hierarchy')
      .getFirstListItem<TypeTagHierarchyRecord>(`tag = "${safe}"`)
      .catch(() => null),
    pocketbase.collection('tag_hierarchy').getFullList<TypeTagHierarchyRecord>({ filter: `parent_tag = "${safe}"` }),
  ]);

  if (type === 'rename' && newTag) {
    const safeNew = newTag.toLowerCase().trim();
    if (ownRecord) {
      await pocketbase.collection('tag_hierarchy').update(ownRecord.id, { tag: safeNew });
    }
    for (const child of childRecords) {
      await pocketbase.collection('tag_hierarchy').update(child.id, { parent_tag: safeNew });
    }
  } else if (type === 'merge' && newTag) {
    const safeNew = newTag.toLowerCase().trim();
    if (ownRecord) {
      await pocketbase.collection('tag_hierarchy').delete(ownRecord.id);
    }
    for (const child of childRecords) {
      await pocketbase.collection('tag_hierarchy').update(child.id, { parent_tag: safeNew });
    }
  } else if (type === 'delete') {
    if (ownRecord) {
      await pocketbase.collection('tag_hierarchy').delete(ownRecord.id);
    }
    for (const child of childRecords) {
      await pocketbase.collection('tag_hierarchy').delete(child.id);
    }
  }
}

// ─── Progress Dialog ──────────────────────────────────────────────────────────

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
            Operation complete - {completed} record{completed !== 1 ? 's' : ''} updated.
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Processing {completed} of {total} records…
            </Typography>
            <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4 }} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {pct}% - records are sent one after the other to avoid overloading the server
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

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean;
  type: OperationType;
  tag: string;
  newTag?: string;
  affectedCount: number;
  childTags?: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

const operationMeta: Record<OperationType, { color: 'error' | 'warning' | 'info'; verb: string }> = {
  delete: { color: 'error', verb: 'Delete' },
  rename: { color: 'warning', verb: 'Rename' },
  merge: { color: 'info', verb: 'Merge' },
};

function ConfirmDialog({ open, type, tag, newTag, affectedCount, childTags, onConfirm, onCancel }: ConfirmDialogProps) {
  const meta = operationMeta[type];

  const description = {
    delete: (
      <>
        Remove <strong>"{tag}"</strong> from {affectedCount} pattern{affectedCount !== 1 ? 's' : ''}. This cannot be
        undone.
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
        <Alert severity={meta.color} sx={{ mb: childTags && childTags.length > 0 ? 1.5 : 0 }}>
          {description}
        </Alert>

        {childTags && childTags.length > 0 && (
          <Alert severity="warning" icon={<AccountTreeIcon />}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {childTags.length} child tag{childTags.length !== 1 ? 's' : ''} will become orphaned:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {childTags.map((t) => (
                <Chip key={t} label={t} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
              ))}
            </Box>
          </Alert>
        )}
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

// ─── Set Parent Dialog ────────────────────────────────────────────────────────

interface SetParentDialogProps {
  open: boolean;
  /** The tag whose parent is being set (from the tags view). */
  tag: TypeReadOnlyDatabaseItem | null;
  /** Current hierarchy records - used for descendants guard and current-parent lookup. */
  hierarchy: TypeTagHierarchyRecord[];
  onClose: () => void;
  onSaved: () => void;
}

function SetParentDialog({ open, tag, hierarchy, onClose, onSaved }: SetParentDialogProps) {
  const [selectedParent, setSelectedParent] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const debouncedSearch = useDebounce(inputValue, 400);

  // Current parent from the hierarchy table
  const currentParent = useMemo(
    () => (tag ? (hierarchy.find((h) => h.tag === tag.tag)?.parent_tag ?? undefined) : undefined),
    [tag, hierarchy],
  );

  // Fetch tags matching the search text (server-side, no 500-item cap)
  const { data: searchData, isFetching: searchFetching } = useQueryAdminTagStatsPaginated({
    page: 0,
    pageSize: 50,
    search: debouncedSearch,
    sortField: 'count',
    sortDir: 'desc',
  });

  // Options: search results minus self + descendants (circular-ref guard)
  const options = useMemo(() => {
    if (!tag) return [];
    const descendants = new Set(getDescendants(tag.tag, hierarchy));
    return (searchData?.items ?? [])
      .map((item) => String(item.tag))
      .filter((name) => name !== tag.tag && !descendants.has(name));
  }, [tag, searchData, hierarchy]);

  // Pre-fill with current parent when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedParent(currentParent);
      setInputValue(currentParent ?? '');
      setError(null);
    }
  }, [open, currentParent]);

  const handleSave = async () => {
    if (!tag) return;
    setSaving(true);
    setError(null);
    try {
      if (selectedParent) {
        await setTagParent(tag.tag, selectedParent);
      } else {
        await clearTagParent(tag.tag);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AccountTreeOutlinedIcon color="primary" fontSize="small" />
        Set Parent for "{tag?.tag}"
      </DialogTitle>
      <DialogContent>
        {currentParent && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Current parent: <strong>{currentParent}</strong>
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ py: 2 }}>
          <Autocomplete
            options={options}
            disableClearable
            value={selectedParent}
            onChange={(_, v) => setSelectedParent(v)}
            inputValue={inputValue}
            onInputChange={(_, v) => setInputValue(v)}
            getOptionLabel={(option) => String(option)}
            filterOptions={(x) => x}
            loading={searchFetching}
            loadingText="Searching…"
            noOptionsText={debouncedSearch ? 'No tags found' : 'Type to search tags'}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Parent tag (leave blank to make this a root tag)"
                size="small"
                placeholder="Search tags…"
              />
            )}
            sx={{ mt: 0.5 }}
          />
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Descendants of "{tag?.tag}" are excluded to prevent circular references.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {currentParent && (
          <Button
            color="warning"
            onClick={async () => {
              setSelectedParent(undefined);
              setSaving(true);
              setError(null);
              try {
                await clearTagParent(tag!.tag);
                onSaved();
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            Clear Parent
          </Button>
        )}
        <Button onClick={handleSave} variant="contained" loading={saving}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Tree View ────────────────────────────────────────────────────────────────

interface TreeNodeProps {
  tagName: string;
  count: number;
  hierarchy: TypeTagHierarchyRecord[];
  allTagStats: Map<string, number>;
  depth?: number;
  onSetParent: (tagName: string) => void;
}

function TreeNode({ tagName, count, hierarchy, allTagStats, depth = 0, onSetParent }: TreeNodeProps) {
  const [open, setOpen] = useState(true);
  const children = hierarchy.filter((h) => h.parent_tag === tagName);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 0.5,
          px: 1,
          ml: depth * 3,
          borderRadius: 1,
          '&:hover': { backgroundColor: 'action.hover' },
        }}
      >
        {children.length > 0 ? (
          <IconButton size="small" onClick={() => setOpen((v) => !v)} sx={{ p: 0.25 }}>
            <AccountTreeIcon fontSize="small" color={open ? 'primary' : 'action'} />
          </IconButton>
        ) : (
          <Box sx={{ width: 28 }} />
        )}

        <Chip label={tagName} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />

        <Typography variant="caption" color="text.secondary">
          {count} pattern{count !== 1 ? 's' : ''}
        </Typography>

        {children.length > 0 && (
          <Typography variant="caption" color="text.disabled">
            · {children.length} child{children.length !== 1 ? 'ren' : ''}
          </Typography>
        )}

        <Box sx={{ flex: 1 }} />

        <Tooltip title="Set parent tag">
          <IconButton size="small" onClick={() => onSetParent(tagName)}>
            <AccountTreeOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {children.length > 0 && (
        <Collapse in={open}>
          {children.map((child) => (
            <TreeNode
              key={child.tag}
              tagName={child.tag}
              count={allTagStats.get(child.tag) ?? 0}
              hierarchy={hierarchy}
              allTagStats={allTagStats}
              depth={depth + 1}
              onSetParent={onSetParent}
            />
          ))}
        </Collapse>
      )}
    </Box>
  );
}

function TagTreeView({
  hierarchy,
  tagStats,
  onSetParent,
}: {
  hierarchy: TypeTagHierarchyRecord[];
  tagStats: TypeTagStat[];
  onSetParent: (tagName: string) => void;
}) {
  const childTagNames = new Set(hierarchy.map((h) => h.tag));
  const allTagStatsMap = useMemo(() => new Map(tagStats.map((t) => [t.tag, t.count])), [tagStats]);

  // Tags that appear in hierarchy as children but whose parent_tag exists in tag stats
  const roots = tagStats.filter((t) => !childTagNames.has(t.tag));

  // Orphaned: in hierarchy as a child but their parent_tag doesn't exist in tag stats
  const allTagNames = new Set(tagStats.map((t) => t.tag));
  const orphans = hierarchy.filter((h) => !allTagNames.has(h.parent_tag));

  if (hierarchy.length === 0) {
    return (
      <Alert severity="info">
        No parent/child relationships defined yet. Use "Set Parent" on any tag to start building the hierarchy.
      </Alert>
    );
  }

  return (
    <Box>
      {roots.map((root) => (
        <TreeNode
          key={root.tag}
          tagName={root.tag}
          count={root.count}
          hierarchy={hierarchy}
          allTagStats={allTagStatsMap}
          depth={0}
          onSetParent={onSetParent}
        />
      ))}

      {orphans.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600, px: 1, display: 'block', mb: 0.5 }}>
            Orphaned - parent tag no longer exists
          </Typography>
          {orphans.map((h) => (
            <TreeNode
              key={h.tag}
              tagName={h.tag}
              count={allTagStatsMap.get(h.tag) ?? 0}
              hierarchy={hierarchy}
              allTagStats={allTagStatsMap}
              depth={0}
              onSetParent={onSetParent}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

// ─── Rename / Merge Panel ─────────────────────────────────────────────────────

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
          ? 'Replaces the tag name across all patterns. Child relationships in the hierarchy are keyed on tag name - rename will update them automatically.'
          : 'Adds the target tag to all patterns that have the source tag, then removes the source tag.'}
      </Typography>
    </Paper>
  );
}

// ─── Low-Use Cleanup Panel ────────────────────────────────────────────────────

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
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
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
          slotProps={{ htmlInput: { min: 1 } }}
        />
      </Box>

      {candidates.length === 0 ? (
        <Alert severity="success" icon={<CheckCircleOutlineIcon />}>
          No tags found with ≤ {threshold} use{threshold !== 1 ? 's' : ''}. Your tag library is clean!
        </Alert>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 2 }}>
            Found <strong>{candidates.length}</strong> tag{candidates.length !== 1 ? 's' : ''} used {threshold} time
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
              Delete {selected.size} selected tag{selected.size !== 1 ? 's' : ''}
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TagManagementPage = () => {
  const queryClient = useQueryClient();

  const { data: tagStats = [] } = useQueryAdminTagStats();
  const { data: hierarchy = [], refetch: refetchHierarchy } = useQueryGetTagHierarchy();

  const { setIsFetchingPatterns } = useGlobalIsFetchingPatterns();

  // ── All Tags table ─────────────────────────────────────────────────────────
  const [tagSearch, setTagSearch] = useState('');
  const debouncedSearch = useDebounce(tagSearch, 400);
  const [tagPaginationModel, setTagPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [tagSortModel, setTagSortModel] = useState<GridSortModel>([{ field: 'count', sort: 'desc' }]);
  const [tagViewMode, setTagViewMode] = useState<'list' | 'tree'>('list');

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

  // ── Set Parent dialog ──────────────────────────────────────────────────────
  const [setParentRow, setSetParentRow] = useState<TypeReadOnlyDatabaseItem | null>(null);

  const handleSetParentSaved = useCallback(() => {
    refetchHierarchy();
    queryClient.invalidateQueries({ queryKey: TAG_HIERARCHY_QUERY_KEY });
  }, [refetchHierarchy, queryClient]);

  // ── Operation state ────────────────────────────────────────────────────────
  const [pendingOp, setPendingOp] = useState<{
    type: OperationType;
    tag: string;
    newTag?: string;
    affectedCount: number;
    childTags?: string[];
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
        setIsFetchingPatterns(true);

        const records = await fetchPatternsWithTag(tag);

        if (records.length > 0) {
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
            (completed, total) => setProgress((p) => ({ ...p, completed, total })),
          );
        }

        // Always update the hierarchy after pattern processing - runs even when
        // the tag has 0 patterns, and uses a fresh PocketBase fetch so the
        // React Query cache can never cause a missed update.
        await updateHierarchyForOp(type, tag, newTag);
        refetchHierarchy();
        queryClient.invalidateQueries({ queryKey: TAG_HIERARCHY_QUERY_KEY });

        setProgress((p) => ({ ...p, done: true, total: records.length, completed: records.length }));
        queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_PAGINATED_QUERY_KEY });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setProgress((p) => ({ ...p, error: msg }));
      }

      setIsFetchingPatterns(false);
    },
    [queryClient, refetchHierarchy],
  );

  const startOp = useCallback(
    async (type: OperationType, tag: string, newTag?: string) => {
      setIsFetchingPatterns(true);

      const records = await fetchPatternsWithTag(tag);

      // For delete: warn about direct children that will become orphaned
      const childTags = type === 'delete' ? hierarchy.filter((h) => h.parent_tag === tag).map((h) => h.tag) : [];

      setPendingOp({ type, tag, newTag, affectedCount: records.length, childTags });
      setIsFetchingPatterns(false);
    },
    [hierarchy],
  );

  const startDeleteMany = useCallback(async (tags: string[]) => {
    // For bulk cleanup, sum affected records - fetched one at a time
    let total = 0;
    setIsFetchingPatterns(true);

    for (const t of tags) {
      const records = await fetchPatternsWithTag(t);
      total += records.length;
      await sleep(BATCH_DELAY_MS);
    }

    setPendingOp({ type: 'delete', tag: `${tags.length} tags`, affectedCount: total });
    (window as any).__pendingDeleteTags = tags;
    setIsFetchingPatterns(false);
  }, []);

  const confirmOp = useCallback(async () => {
    if (!pendingOp) return;
    const op = { ...pendingOp };
    setPendingOp(null);

    if (op.tag.endsWith(' tags') && (window as any).__pendingDeleteTags) {
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
              await pocketbase.collection('patterns').update(r.id, { tags: r.tags.filter((t) => t !== tag) });
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
      await executeOperation({ type: op.type, tag: op.tag, newTag: op.newTag });
    }
  }, [pendingOp, executeOperation, queryClient]);

  // ── Sync Ancestor Tags ─────────────────────────────────────────────────────
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);

  const runSyncAncestors = useCallback(async () => {
    setSyncConfirmOpen(false);

    const allPatterns: TypePatternRecord[] = [];
    let page = 1;
    while (true) {
      const result = await pocketbase
        .collection('patterns')
        .getList<TypePatternRecord>(page, 500, { fields: 'id,tags' });
      allPatterns.push(...result.items);
      if (allPatterns.length >= result.totalItems) break;
      page++;
    }

    const needsUpdate = allPatterns.filter((p) => {
      if (!Array.isArray(p.tags)) return false;
      for (const tag of p.tags) {
        const ancestors = getAncestors(tag, hierarchy);
        if (ancestors.some((a) => !p.tags.includes(a))) return true;
      }
      return false;
    });

    if (needsUpdate.length === 0) {
      setToast('All patterns already have up-to-date parent tags.');
      return;
    }

    setProgress({
      open: true,
      title: `Syncing parent tags across ${needsUpdate.length} patterns…`,
      completed: 0,
      total: needsUpdate.length,
      done: false,
    });

    try {
      setIsFetchingPatterns(true);

      await processSequentially(
        needsUpdate,
        async (pattern) => {
          const newTags = [...pattern.tags];
          for (const tag of [...pattern.tags]) {
            for (const a of getAncestors(tag, hierarchy)) {
              if (!newTags.includes(a)) newTags.push(a);
            }
          }
          await pocketbase.collection('patterns').update(pattern.id, { tags: newTags });
          await sleep(BATCH_DELAY_MS);
        },
        (completed, total) => setProgress((p) => ({ ...p, completed, total })),
      );

      setProgress((p) => ({ ...p, done: true }));
      queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_PAGINATED_QUERY_KEY });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setProgress((p) => ({ ...p, error: msg }));
    } finally {
      setIsFetchingPatterns(false);
    }
  }, [hierarchy, queryClient]);

  const uniqueTagCount = tagStats.length;
  const totalTagUsages = tagStats.reduce((s, t) => s + t.count, 0);

  // ── DataGrid column definitions ────────────────────────────────────────────
  const tagColumns: GridColDef<TypeReadOnlyDatabaseItem>[] = useMemo(
    () => [
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
        field: 'parent',
        headerName: 'Parent',
        width: 160,
        sortable: false,
        disableColumnMenu: true,
        renderCell: (params) => {
          const parentName = hierarchy.find((h) => h.tag === params.row.tag)?.parent_tag;
          return parentName ? (
            <Chip label={parentName} size="small" variant="outlined" color="primary" sx={{ fontFamily: 'monospace' }} />
          ) : (
            <Typography variant="caption" color="text.disabled">
              -
            </Typography>
          );
        },
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
        width: 110,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Set parent tag">
              <IconButton size="small" onClick={() => setSetParentRow(params.row)}>
                <AccountTreeOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete this tag globally">
              <IconButton size="small" onClick={() => startOp('delete', params.row.tag)} color="error">
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ),
      },
    ],
    [hierarchy, startOp],
  );

  return (
    <>
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
              <Chip
                label={`${hierarchy.length} hierarchy relationships`}
                color="info"
                variant="outlined"
                size="small"
                icon={<AccountTreeIcon fontSize="small" />}
              />
            </Box>
          </>
        }
      />

      {/* All Tags header row */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1, minWidth: 120 }}>
          All Tags
        </Typography>

        {tagViewMode === 'list' && (
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
        )}

        <ToggleButtonGroup value={tagViewMode} exclusive onChange={(_, v) => v && setTagViewMode(v)} size="small">
          <ToggleButton value="list">
            <Tooltip title="List view">
              <ListIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="tree">
            <Tooltip title="Tree view">
              <AccountTreeIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        {tagViewMode === 'list' && (
          <Button size="small" onClick={() => refetchTagPage()} variant="outlined" color="inherit">
            Refresh
          </Button>
        )}

        {/*<Tooltip title="Walk all patterns and add any missing parent tags based on the current hierarchy. Safe to run multiple times.">
          <Button
            size="small"
            variant="outlined"
            color="info"
            startIcon={<SyncIcon fontSize="small" />}
            onClick={() => setSyncConfirmOpen(true)}
          >
            Sync Parent Tags
          </Button>
        </Tooltip>*/}
      </Box>

      {tagPageError && tagViewMode === 'list' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load tags. Check your PocketBase connection.
        </Alert>
      )}

      {tagViewMode === 'list' && (
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
      )}

      {tagViewMode === 'tree' && (
        <Paper variant="outlined" sx={{ p: 2, minHeight: 200, maxHeight: 600, overflowY: 'auto' }}>
          <TagTreeView
            hierarchy={hierarchy}
            tagStats={tagStats}
            onSetParent={(name) => {
              const row = tagPageData?.items.find((r) => r.tag === name) ?? { id: name, tag: name, count: 0 };
              setSetParentRow(row as TypeReadOnlyDatabaseItem);
            }}
          />
        </Paper>
      )}

      {/* Set Parent Dialog */}
      <SetParentDialog
        open={!!setParentRow}
        tag={setParentRow}
        hierarchy={hierarchy}
        onClose={() => setSetParentRow(null)}
        onSaved={handleSetParentSaved}
      />

      {/* Sync Ancestor Tags confirmation */}
      <Dialog open={syncConfirmOpen} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SyncIcon color="info" />
          Sync Parent Tags
        </DialogTitle>
        <DialogContent>
          <Alert severity="info">
            This will scan the database for all patterns, and automatically add any missing parent tags based on the
            current tag list. Existing tags are not removed. Only missing parents are added.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSyncConfirmOpen(false)}>Cancel</Button>
          <Button onClick={runSyncAncestors} variant="contained" color="info" startIcon={<SyncIcon />}>
            Run Sync
          </Button>
        </DialogActions>
      </Dialog>

      {pendingOp && (
        <ConfirmDialog
          open={true}
          type={pendingOp.type}
          tag={pendingOp.tag}
          newTag={pendingOp.newTag}
          affectedCount={pendingOp.affectedCount}
          childTags={pendingOp.childTags}
          onConfirm={confirmOp}
          onCancel={() => setPendingOp(null)}
        />
      )}

      <ProgressDialog
        open={progress.open}
        title={progress.title}
        completed={progress.completed}
        total={progress.total}
        done={progress.done}
        error={progress.error}
        onClose={() => setProgress({ open: false, title: '', completed: 0, total: 0, done: false })}
      />

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <Box sx={{ mb: 3, mt: 3 }}>
        <RenameOrMergePanel
          tagStats={tagStats}
          onRename={(from, to) => startOp('rename', from, to)}
          onMerge={(from, into) => startOp('merge', from, into)}
        />
      </Box>

      <Box sx={{ mb: 3 }}>
        <CleanupPanel tagStats={tagStats} onDeleteMany={startDeleteMany} />
      </Box>
    </>
  );
};
