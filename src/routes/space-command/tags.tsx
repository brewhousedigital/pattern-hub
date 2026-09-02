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
  useQueryGetAllTagsV2,
  useQueryGetAllTagTypes,
  TAGS_V2_QUERY_KEY,
  type TypeTagStat,
  type TypePatternRecord,
  type TypeTagHierarchyRecord,
  type TypeTagV2Record,
  type TypeTagTypeRecord,
} from '@/functions/database/tags';
import { processSequentially } from '@/functions/utilities/batch-write';
import { slugifyTag } from '@/functions/utilities/slugify-tag';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { useAdminLogger } from '@/functions/database/admin-logs';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { GenericMarkdownEditor } from '@/components/admin/GenericMarkdownEditor';
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
import EditNoteIcon from '@mui/icons-material/EditNote';

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
  head: ({ match }) => generateSEO('Tags - Admin', '', match.pathname),
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
 * Fetch ALL patterns that contain a specific tag (exact element match).
 * Wrapping in double-quotes matches the JSON storage format ["tag1","tag2"],
 * so '"cat"' matches "cat" but not "suncatcher".
 */
async function fetchPatternsWithTag(tag: string): Promise<TypePatternRecord[]> {
  const records: TypePatternRecord[] = [];
  let page = 1;
  const perPage = 500;

  while (true) {
    const result = await pocketbase
      .collection('patterns')
      .getList<TypePatternRecord>(page, perPage, { filter: `tags ~ '"${tag}"'`, fields: 'id,tags,name' });
    records.push(...result.items);
    if (records.length >= result.totalItems) break;
    page++;
  }

  return records;
}

// processSequentially (batch-with-delay writes) now lives in
// src/functions/utilities/batch-write.ts, imported above - see that file's
// doc comment. `sleep`/`BATCH_DELAY_MS` above stay local: a few call sites
// below use them directly for a standalone delay, outside of any
// processSequentially batch.

// ─── tags_v2 lookup + slug helpers ─────────────────────────────────────────────
//
// tags_v2 is the canonical tag-metadata table added in Phase 1 of the tag
// redesign (see TAG_REDESIGN_PROJECT_NOTES.md) - a row here holds a tag's
// Type, Definition, and disambiguation note. syncSatelliteTablesForOp below
// keeps it in sync with tag_hierarchy whenever an admin renames, merges, or
// deletes a tag, so those satellite fields never silently detach from the
// live tag string. Uses the full TypeTagV2Record imported from
// functions/database/tags.ts (the same type the metadata dialog below
// reads/writes) rather than a narrower local shape.

async function findTagV2Record(tagName: string): Promise<TypeTagV2Record | null> {
  return await pocketbase
    .collection('tags_v2')
    .getFirstListItem<TypeTagV2Record>(`tag = "${tagName}"`)
    .catch(() => null);
}

async function isSlugTaken(slug: string, excludeId: string): Promise<boolean> {
  const match = await pocketbase
    .collection('tags_v2')
    .getFirstListItem(`slug = "${slug}" && id != "${excludeId}"`)
    .catch(() => null);
  return !!match;
}

// Disambiguates a slug collision the same way scripts/backfill-tags-v2.mjs
// does - append -2, -3, ... until the candidate is free. `excludeId` keeps
// a record from colliding with its own current slug while it's mid-rename.
async function uniqueSlugFor(baseSlug: string, excludeId: string): Promise<string> {
  let candidate = baseSlug;
  let suffix = 2;
  while (await isSlugTaken(candidate, excludeId)) {
    candidate = `${baseSlug}-${suffix++}`;
  }
  return candidate;
}

// ─── Satellite-table sync ──────────────────────────────────────────────────────
//
// Always fetches fresh records from PocketBase so stale React Query cache
// can never cause a missed update. Called after pattern processing for every
// rename / merge / delete operation. Keeps two tables in sync with the tag
// string itself:
//
//   tag_hierarchy (parent/child, being replaced by the implied-tags graph in
//   Phase 2, but still the live mechanism through Phase 2):
//     rename  - updates the tag's own name in its parent record and updates
//               every child's parent_tag reference to the new name.
//     merge   - removes the source tag's own parent record (it no longer
//               exists) and re-parents its children to the merge target.
//     delete  - removes the tag's own parent record and removes the parent
//               records of any children (they become root tags).
//
//   tags_v2 (Type, Definition, disambiguation note - see the section above):
//     rename  - updates the row's `tag` to the new name. If the new name
//               slugifies to something different, assigns a fresh unique
//               slug and files the old slug into `previous_slugs`, so a
//               bookmarked or indexed Definition Page URL still redirects
//               instead of 404ing.
//     merge   - deletes the source tag's row (matching the tag_hierarchy
//               behavior above). The merge target's own row, if it has one,
//               is untouched - a merge does not transfer Type/Definition
//               from the source, since the two tags may not actually mean
//               the same thing in a way that makes that safe to assume.
//     delete  - deletes the row.
//
// TODO(tags_v2 admin UI): once the Type-assignment/Definition admin screen
// exists, invalidate its query key here too, alongside the hierarchy
// invalidation at this function's call site, so an edit here shows up
// immediately instead of waiting for that screen's own refetch.

async function syncSatelliteTablesForOp(type: OperationType, tag: string, newTag?: string) {
  const safe = tag.toLowerCase().trim();

  const [ownRecord, childRecords, tagV2Record] = await Promise.all([
    pocketbase
      .collection('tag_hierarchy')
      .getFirstListItem<TypeTagHierarchyRecord>(`tag = "${safe}"`)
      .catch(() => null),
    pocketbase.collection('tag_hierarchy').getFullList<TypeTagHierarchyRecord>({ filter: `parent_tag = "${safe}"` }),
    findTagV2Record(safe),
  ]);

  if (type === 'rename' && newTag) {
    const safeNew = newTag.toLowerCase().trim();
    if (ownRecord) {
      await pocketbase.collection('tag_hierarchy').update(ownRecord.id, { tag: safeNew });
    }
    for (const child of childRecords) {
      await pocketbase.collection('tag_hierarchy').update(child.id, { parent_tag: safeNew });
    }
    if (tagV2Record) {
      const candidateSlug = slugifyTag(safeNew);
      const slugChanged = candidateSlug !== '' && candidateSlug !== tagV2Record.slug;
      const newSlug = slugChanged ? await uniqueSlugFor(candidateSlug, tagV2Record.id) : tagV2Record.slug;
      const previousSlugs = slugChanged
        ? [...new Set([...tagV2Record.previous_slugs, tagV2Record.slug])]
        : tagV2Record.previous_slugs;
      await pocketbase
        .collection('tags_v2')
        .update(tagV2Record.id, { tag: safeNew, slug: newSlug, previous_slugs: previousSlugs });
    }
  } else if (type === 'merge' && newTag) {
    const safeNew = newTag.toLowerCase().trim();
    if (ownRecord) {
      await pocketbase.collection('tag_hierarchy').delete(ownRecord.id);
    }
    for (const child of childRecords) {
      await pocketbase.collection('tag_hierarchy').update(child.id, { parent_tag: safeNew });
    }
    if (tagV2Record) {
      await pocketbase.collection('tags_v2').delete(tagV2Record.id);
    }
  } else if (type === 'delete') {
    if (ownRecord) {
      await pocketbase.collection('tag_hierarchy').delete(ownRecord.id);
    }
    for (const child of childRecords) {
      await pocketbase.collection('tag_hierarchy').delete(child.id);
    }
    if (tagV2Record) {
      await pocketbase.collection('tags_v2').delete(tagV2Record.id);
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
  const { log } = useAdminLogger();

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
        log({
          action: 'Tag Parent Set',
          entity_type: 'Tag',
          entity_id: tag.tag,
          entity_name: tag.tag,
          changes: { parent: { from: currentParent ?? null, to: selectedParent } },
          metadata: {},
        });
      } else {
        await clearTagParent(tag.tag);
        log({
          action: 'Tag Parent Cleared',
          entity_type: 'Tag',
          entity_id: tag.tag,
          entity_name: tag.tag,
          changes: { parent: { from: currentParent ?? null, to: null } },
          metadata: {},
        });
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
                log({
                  action: 'Tag Parent Cleared',
                  entity_type: 'Tag',
                  entity_id: tag!.tag,
                  entity_name: tag!.tag,
                  changes: { parent: { from: currentParent ?? null, to: null } },
                  metadata: {},
                });
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

// ─── Tag Metadata Dialog ────────────────────────────────────────────────────────
//
// Edits a tag's tags_v2 row (Type, Definition, disambiguation note - Phase 1
// of the tag redesign, see TAG_REDESIGN_PROJECT_NOTES.md). Most tags already
// have a row by the time an admin opens this, via the backfill or the
// /api/sync-tag-catalog cron - but a just-typed tag that hasn't synced yet
// won't, so this creates one on first save rather than assuming it exists.

interface TagMetadataDialogProps {
  open: boolean;
  /** The tag being edited (from the tags view). */
  tag: TypeReadOnlyDatabaseItem | null;
  /** This tag's existing tags_v2 row, if it has one yet. */
  existingRecord: TypeTagV2Record | null;
  tagTypes: TypeTagTypeRecord[];
  onClose: () => void;
  onSaved: () => void;
}

function TagMetadataDialog({ open, tag, existingRecord, tagTypes, onClose, onSaved }: TagMetadataDialogProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [definition, setDefinition] = useState('');
  const [disambiguationNote, setDisambiguationNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { log } = useAdminLogger();

  // Pre-fill from the existing row (if any) whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setSelectedTypeId(existingRecord?.type ?? '');
      setDefinition(existingRecord?.definition ?? '');
      setDisambiguationNote(existingRecord?.disambiguation_note ?? '');
      setError(null);
    }
  }, [open, existingRecord]);

  const handleSave = async () => {
    if (!tag) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { type: selectedTypeId, definition, disambiguation_note: disambiguationNote };

      if (existingRecord) {
        await pocketbase.collection('tags_v2').update(existingRecord.id, payload);
      } else {
        const baseSlug = slugifyTag(tag.tag);
        // '' as excludeId is safe here - no real record ever has an empty
        // id, so `id != ""` (inside isSlugTaken) matches every existing row,
        // exactly the "don't exclude anything" behavior a brand-new record
        // needs. Falls back to the raw tag string in the near-impossible
        // case a tag already in use on a pattern slugifies to nothing.
        const slug = baseSlug ? await uniqueSlugFor(baseSlug, '') : tag.tag;
        await pocketbase.collection('tags_v2').create({ tag: tag.tag, slug, previous_slugs: [], ...payload });
      }

      log({
        action: existingRecord ? 'Tag Metadata Updated' : 'Tag Metadata Created',
        entity_type: 'Tag',
        entity_id: tag.tag,
        entity_name: tag.tag,
        changes: {
          type: { from: existingRecord?.type || null, to: selectedTypeId || null },
          definition: { from: existingRecord?.definition ?? '', to: definition },
          disambiguation_note: { from: existingRecord?.disambiguation_note ?? '', to: disambiguationNote },
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EditNoteIcon color="primary" fontSize="small" />
        Edit "{tag?.tag}"
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ py: 1 }}>
          <Autocomplete
            options={tagTypes}
            value={tagTypes.find((t) => t.id === selectedTypeId) ?? null}
            onChange={(_, v) => setSelectedTypeId(v?.id ?? '')}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField {...params} label="Type" size="small" placeholder="General (default - leave blank)" />
            )}
          />
        </Box>

        <Box sx={{ py: 1 }}>
          <TextField
            label="Disambiguation note"
            placeholder={'e.g. "the center of a flower" for a tag like eye (flower)'}
            value={disambiguationNote}
            onChange={(e) => setDisambiguationNote(e.target.value)}
            size="small"
            fullWidth
          />
        </Box>

        <Box sx={{ py: 1 }}>
          <GenericMarkdownEditor
            content={definition}
            setContent={setDefinition}
            label="Definition"
            minRows={6}
            maxRows={20}
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
  const { log } = useAdminLogger();

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

  // ── Tag metadata (Type + Definition) dialog ────────────────────────────────
  //
  // tags_v2 holds the canonical Type/Definition/disambiguation-note metadata
  // added in Phase 1 of the tag redesign (see TAG_REDESIGN_PROJECT_NOTES.md).
  // Full-list fetches, same convention as `hierarchy` above - a per-row Map
  // lookup client-side rather than a query per DataGrid row.
  const [metadataRow, setMetadataRow] = useState<TypeReadOnlyDatabaseItem | null>(null);
  const { data: tagsV2List = [], refetch: refetchTagsV2 } = useQueryGetAllTagsV2();
  const { data: tagTypesList = [] } = useQueryGetAllTagTypes();
  const tagsV2ByTag = useMemo(() => new Map(tagsV2List.map((r) => [r.tag, r])), [tagsV2List]);

  const handleMetadataSaved = useCallback(() => {
    refetchTagsV2();
    queryClient.invalidateQueries({ queryKey: TAGS_V2_QUERY_KEY });
  }, [refetchTagsV2, queryClient]);

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

        const tagsAffected: string[] = [];
        const patternsAffected: { id: string; name: string }[] = [];

        if (records.length > 0) {
          setProgress((p) => ({ ...p, total: records.length }));

          await processSequentially(
            records,
            async (record) => {
              let updatedTags: string[];
              if (type === 'delete') {
                tagsAffected.push(tag);
                patternsAffected.push({ id: record.id, name: record.name || '' });
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
        await syncSatelliteTablesForOp(type, tag, newTag);
        refetchHierarchy();
        queryClient.invalidateQueries({ queryKey: TAG_HIERARCHY_QUERY_KEY });

        setProgress((p) => ({ ...p, done: true, total: records.length, completed: records.length }));

        const actionLabel = type === 'delete' ? 'Tag Deleted' : type === 'rename' ? 'Tag Renamed' : 'Tag Merged';
        log({
          action: actionLabel,
          entity_type: 'Tag',
          entity_id: tag,
          entity_name: tag,
          changes: newTag ? { tag: { from: tag, to: newTag } } : {},
          metadata: {
            number_of_affected_patterns: records.length,
            type,
            patterns: patternsAffected,
          },
        });

        queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_PAGINATED_QUERY_KEY });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setProgress((p) => ({ ...p, error: msg }));
      }

      setIsFetchingPatterns(false);
    },
    [queryClient, refetchHierarchy, log, setIsFetchingPatterns],
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
    [hierarchy, setIsFetchingPatterns],
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
  }, [setIsFetchingPatterns]);

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
        log({
          action: 'Tags Bulk Deleted',
          entity_type: 'Tag',
          entity_id: '',
          entity_name: `${tags.length} tags`,
          changes: {},
          metadata: { tags, affected_patterns: tags.length },
        });
        queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_PAGINATED_QUERY_KEY });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setProgress((p) => ({ ...p, error: msg }));
      }
    } else {
      await executeOperation({ type: op.type, tag: op.tag, newTag: op.newTag });
    }
  }, [pendingOp, executeOperation, queryClient, log]);

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
      log({
        action: 'Ancestor Tags Synced',
        entity_type: 'Tag',
        entity_id: '',
        entity_name: 'Sync Ancestor Tags',
        changes: {},
        metadata: { patterns_updated: needsUpdate.length },
      });
      queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_PAGINATED_QUERY_KEY });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setProgress((p) => ({ ...p, error: msg }));
    } finally {
      setIsFetchingPatterns(false);
    }
  }, [hierarchy, queryClient, log, setIsFetchingPatterns]);

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
        field: 'type',
        headerName: 'Type',
        width: 130,
        sortable: false,
        disableColumnMenu: true,
        renderCell: (params) => {
          const typeInfo = tagsV2ByTag.get(params.row.tag)?.expand?.type;
          // "General" is the default every tag starts with - a badge for it
          // on every row would just be noise, so only show one for a tag
          // that's been given a real, differentiating Type.
          if (!typeInfo || typeInfo.name.toLowerCase() === 'general') {
            return (
              <Typography variant="caption" color="text.disabled">
                General
              </Typography>
            );
          }
          return (
            <Chip
              label={typeInfo.name}
              size="small"
              sx={typeInfo.color ? { bgcolor: typeInfo.color, color: '#fff' } : undefined}
            />
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
        width: 150,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        align: 'right',
        headerAlign: 'right',
        renderCell: (params) => (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Edit type & definition">
              <IconButton size="small" onClick={() => setMetadataRow(params.row)}>
                <EditNoteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
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
    [hierarchy, startOp, tagsV2ByTag],
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

      {/* Tag Metadata Dialog */}
      <TagMetadataDialog
        open={!!metadataRow}
        tag={metadataRow}
        existingRecord={metadataRow ? (tagsV2ByTag.get(metadataRow.tag) ?? null) : null}
        tagTypes={tagTypesList}
        onClose={() => setMetadataRow(null)}
        onSaved={handleMetadataSaved}
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
