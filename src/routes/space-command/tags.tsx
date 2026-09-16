import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { pocketbase } from '@/functions/database/authentication-setup';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo';
import {
  useQueryAdminTagStats,
  useQueryAdminTagStatsPaginated,
  useQueryGetTagHierarchy,
  TAG_HIERARCHY_QUERY_KEY,
  ADMIN_TAG_STATS_QUERY_KEY,
  ADMIN_TAG_STATS_PAGINATED_QUERY_KEY,
  getAncestors,
  useQueryGetAllTagsV2,
  useQueryGetAllTagTypes,
  useQueryGetImpliedTags,
  useQueryGetAllTagAliases,
  findTagV2Record,
  resolveOrCreateTagRefs,
  TAGS_V2_QUERY_KEY,
  IMPLIED_TAGS_QUERY_KEY,
  TAG_ALIASES_QUERY_KEY,
  type TypePatternRecord,
  type TypeImpliedTagRecord,
  type TypeTagAliasRecord,
} from '@/functions/database/tags';
import {
  type OperationType,
  fetchPatternsWithTagRef,
  syncSatelliteTablesForOp,
} from '@/functions/database/tags-admin/satellite-sync';
import { useGlobalIsFetchingPatterns } from '@/functions/database/tags-admin/useGlobalIsFetchingPatterns';
import { processSequentially } from '@/functions/utilities/batch-write';
import { normalizeTagName } from '@/functions/utilities/normalize-tag';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { useAdminLogger } from '@/functions/database/admin-logs';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { TagGraphView } from '@/components/admin/TagGraphView';
import { ProgressDialog } from '@/components/admin/tags/ProgressDialog';
import { ConfirmDialog } from '@/components/admin/tags/ConfirmDialog';
import { SetParentDialog } from '@/components/admin/tags/SetParentDialog';
import { TagMetadataDialog } from '@/components/admin/tags/TagMetadataDialog';
import { AddTagDialog } from '@/components/admin/tags/AddTagDialog';
import { ImpliedTagsDialog } from '@/components/admin/tags/ImpliedTagsDialog';
import { AliasDialog } from '@/components/admin/tags/AliasDialog';
import { TagTreeView } from '@/components/admin/tags/TagTreeView';
import { RenamePanel } from '@/components/admin/tags/RenamePanel';
import { CleanupPanel } from '@/components/admin/tags/CleanupPanel';
import { buildTagColumns } from '@/components/admin/tags/TagColumns';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

import SearchIcon from '@mui/icons-material/Search';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ListIcon from '@mui/icons-material/List';
import SyncIcon from '@mui/icons-material/Sync';
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import AddIcon from '@mui/icons-material/Add';

import {
  Box,
  Typography,
  TextField,
  MenuItem,
  Button,
  Chip,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  InputAdornment,
  Tooltip,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { DataGrid, type GridSortModel } from '@mui/x-data-grid';

export const Route = createFileRoute('/space-command/tags')({
  component: RouteComponent,
  head: ({ match }) => generateSEO('Tags - Admin', '', match.pathname),
});

function RouteComponent() {
  return <TagManagementPage />;
}

const BATCH_DELAY_MS = 3000;

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// processSequentially (batch-with-delay writes) now lives in
// src/functions/utilities/batch-write.ts, imported above - see that file's
// doc comment. `sleep`/`BATCH_DELAY_MS` above stay local: a few call sites
// below use them directly for a standalone delay, outside of any
// processSequentially batch.

// ─── Main Page ────────────────────────────────────────────────────────────────

const TagManagementPage = () => {
  const queryClient = useQueryClient();
  const { log } = useAdminLogger();

  const { data: tagStats = [] } = useQueryAdminTagStats();
  const { data: hierarchy = [] } = useQueryGetTagHierarchy();
  const { data: tagTypesList = [] } = useQueryGetAllTagTypes();

  const { setIsFetchingPatterns } = useGlobalIsFetchingPatterns();

  // ── All Tags table ─────────────────────────────────────────────────────────
  const [tagSearch, setTagSearch] = useState('');
  const debouncedSearch = useDebounce(tagSearch, 400);
  // '' = All types; otherwise a tag_types id (see typeFilterExpr below).
  // Defaults to the General type once tagTypesList loads - see the effect
  // below, which applies that default exactly once so it never overrides a
  // later, deliberate "All types" selection.
  const [tagTypeFilter, setTagTypeFilter] = useState('');
  const didSetDefaultTypeFilter = useRef(false);
  const [tagPaginationModel, setTagPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [tagSortModel, setTagSortModel] = useState<GridSortModel>([{ field: 'count', sort: 'desc' }]);
  const [tagViewMode, setTagViewMode] = useState<'list' | 'tree' | 'graph'>('list');

  // Set by a row's own Rename action (see TagColumns) - RenamePanel picks
  // this up to seed "current tag name" and scroll/focus itself into view.
  const [renamePrefill, setRenamePrefill] = useState<{ tag: string; nonce: number } | null>(null);

  useEffect(() => {
    setTagPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, [debouncedSearch, tagTypeFilter]);

  useEffect(() => {
    if (didSetDefaultTypeFilter.current || tagTypesList.length === 0) return;
    didSetDefaultTypeFilter.current = true;
    const general = tagTypesList.find((t) => t.name.toLowerCase() === 'general');
    if (general) setTagTypeFilter(general.id);
  }, [tagTypesList]);

  // "General" also stands in for an untyped tag (see TagColumns.tsx's Type
  // column, which shows "General" for a blank type the same way) - matching
  // it here means an admin filtering to General gets both, one bucket, not
  // two. See useQueryAdminTagStatsPaginated's own doc comment for the
  // tag_usage view change this depends on.
  const typeFilterExpr = useMemo(() => {
    if (!tagTypeFilter) return undefined;
    const safeId = tagTypeFilter.replace(/"/g, '\\"');
    const selected = tagTypesList.find((t) => t.id === tagTypeFilter);
    if (selected?.name.toLowerCase() === 'general') {
      return `(type = "${safeId}" || type = "")`;
    }
    return `type = "${safeId}"`;
  }, [tagTypeFilter, tagTypesList]);

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
    typeFilter: typeFilterExpr,
    sortField: (sortItem?.field as 'tag' | 'count') ?? 'count',
    sortDir: (sortItem?.sort as 'asc' | 'desc') ?? 'desc',
  });

  // ── Set Parent dialog ──────────────────────────────────────────────────────
  const [setParentRow, setSetParentRow] = useState<TypeReadOnlyDatabaseItem | null>(null);

  // invalidateQueries alone already refetches this - it's actively mounted
  // right here - a paired refetch() call fired the same GET a second time.
  const handleSetParentSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: TAG_HIERARCHY_QUERY_KEY });
  }, [queryClient]);

  // ── Tag metadata (Type + Definition) dialog ────────────────────────────────
  //
  // tags_v2 holds the canonical Type/Definition/disambiguation-note
  // metadata. Full-list fetches, same convention as `hierarchy` above - a
  // per-row Map lookup client-side rather than a query per DataGrid row.
  const [metadataRow, setMetadataRow] = useState<TypeReadOnlyDatabaseItem | null>(null);
  const { data: tagsV2List = [] } = useQueryGetAllTagsV2();
  // Keyed by id, not by `tag` (the display name). Since two tags_v2 rows
  // can share a name (e.g. the "autumn (artist)" -> "autumn" rename that
  // exercised this for real), a name-keyed Map can only ever hold one of
  // them - the other silently vanishes from lookups that share this map.
  // That's cosmetic for the Type column's badge below, but a real
  // correctness bug for TagMetadataDialog's existingRecord: two grid rows
  // both named "autumn" would resolve to the same tags_v2 row (whichever
  // `tagsV2List` happened to place last for that key), so editing either
  // one's Type/Definition/linked account could silently read and save over
  // the OTHER row's data instead. tagPageData's own rows (from the
  // tag_usage view) already carry the real, stable tags_v2 id for this
  // exact reason - see useQueryAdminTagStatsPaginated's own doc comment -
  // so every caller below looks up by id, not by tag.
  const tagsV2ById = useMemo(() => new Map(tagsV2List.map((r) => [r.id, r])), [tagsV2List]);

  const handleMetadataSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: TAGS_V2_QUERY_KEY });
  }, [queryClient]);

  // ── Implied Tags dialog ────────────────────────────────────────────────────
  const [impliedTagsRow, setImpliedTagsRow] = useState<TypeReadOnlyDatabaseItem | null>(null);
  const { data: impliedTagsList = [] } = useQueryGetImpliedTags();

  // Name-keyed, one bucket per side of the edge - mirrors
  // ImpliedTagsDialog's own outgoing/incoming lookups
  // (impliedTags.filter((e) => e.tag === tag.tag) etc.). implied_tags is a
  // name-based relation by design (unlike tagsV2ById above, which has to be
  // id-keyed for correctness - see its own comment), so this matches the
  // dialog's existing resolution instead of inventing a second convention
  // for the same table. Feeds TagColumns.tsx's Relations badge below.
  const impliesByTag = useMemo(() => {
    const map = new Map<string, TypeImpliedTagRecord[]>();
    for (const edge of impliedTagsList) {
      const arr = map.get(edge.tag);
      if (arr) arr.push(edge);
      else map.set(edge.tag, [edge]);
    }
    return map;
  }, [impliedTagsList]);
  const impliedByTag = useMemo(() => {
    const map = new Map<string, TypeImpliedTagRecord[]>();
    for (const edge of impliedTagsList) {
      const arr = map.get(edge.implies_tag);
      if (arr) arr.push(edge);
      else map.set(edge.implies_tag, [edge]);
    }
    return map;
  }, [impliedTagsList]);

  const handleImpliedTagsSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: IMPLIED_TAGS_QUERY_KEY });
  }, [queryClient]);

  // Memoized rather than an inline arrow function - TagGraphView's graph
  // layout is a memo keyed partly on this callback's identity, and an
  // unstable one would replay its settle animation on every unrelated
  // re-render of this page instead of only when the graph's data changes.
  const handleTagGraphNodeClick = useCallback((tag: TypeReadOnlyDatabaseItem) => setImpliedTagsRow(tag), []);

  // ── Alias dialog ────────────────────────────────────────────────────────────
  const [aliasRow, setAliasRow] = useState<TypeReadOnlyDatabaseItem | null>(null);
  const { data: tagAliasesList = [] } = useQueryGetAllTagAliases();

  // Name-keyed, mirroring AliasDialog's own ownAlias/pointingHere lookups.
  // aliasByOwnName answers "is this row itself registered as an alias of
  // some other, root tag" - possible even for a row with real usage, since
  // AliasDialog's "Make this tag an alias of…" field (handleSetAlias) can
  // point an already-real, already-in-use tag at another root without
  // touching its own tags_v2 row or any pattern's tag_refs; that's a
  // different action from handleAddIncomingAlias, which blocks creating a
  // new alias string that collides with an existing tags_v2 row. A pure
  // alias string with no tags_v2 row of its own (e.g. "orca") never has a
  // row here to key against - it only ever surfaces inside its target's own
  // aliasesByTarget list below. Feeds TagColumns.tsx's Relations badge.
  const aliasByOwnName = useMemo(() => new Map(tagAliasesList.map((a) => [a.alias, a])), [tagAliasesList]);
  const aliasesByTarget = useMemo(() => {
    const map = new Map<string, TypeTagAliasRecord[]>();
    for (const a of tagAliasesList) {
      const arr = map.get(a.target_tag);
      if (arr) arr.push(a);
      else map.set(a.target_tag, [a]);
    }
    return map;
  }, [tagAliasesList]);

  const handleAliasSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: TAG_ALIASES_QUERY_KEY });
  }, [queryClient]);

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
    successMessage?: string;
  }>({ open: false, title: '', completed: 0, total: 0, done: false });

  const [toast, setToast] = useState<string | null>(null);

  // ── Add Tag dialog ─────────────────────────────────────────────────────────
  // Creates a tags_v2 row directly, with no pattern attached. It shows up in
  // the grid below right away (tag_usage's view query was updated to a LEFT
  // JOIN - see useQueryAdminTagStatsPaginated's own comment), but sorted
  // last under the grid's default "most patterns first" sort - the toast
  // points at the "unused tags" chip so the admin doesn't have to go hunting
  // for the page it landed on.
  const [addTagOpen, setAddTagOpen] = useState(false);

  const handleTagCreated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: TAGS_V2_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_PAGINATED_QUERY_KEY });
    setToast('Tag created. Use the "unused tags" chip above to find it.');
  }, [queryClient]);

  // Every rename/merge/delete touches all four of these tables - single-tag
  // (executeOperation) and bulk (confirmOp's cleanup branch) both need the
  // same invalidation list, so it lives here once rather than as two copies
  // that could drift apart.
  const invalidateTagSatelliteQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: TAG_HIERARCHY_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: TAGS_V2_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: IMPLIED_TAGS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: TAG_ALIASES_QUERY_KEY });
  }, [queryClient]);

  const executeOperation = useCallback(
    async (op: { type: OperationType; tag: string; newTag?: string }) => {
      const { type, tag } = op;
      // Normalized once, here, so every downstream use - the patterns.tags
      // rewrite below, and syncSatelliteTablesForOp - agrees on the exact
      // same canonical value. Previously the raw, un-normalized newTag was
      // written straight into patterns.tags while syncSatelliteTablesForOp
      // normalized separately, so a case-different rename left patterns
      // holding a different string than tags_v2/tag_hierarchy (found via
      // code review).
      const newTag = op.newTag ? normalizeTagName(op.newTag) : op.newTag;

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

        // All pattern-level work happens inside syncSatelliteTablesForOp
        // itself, id-based (tag_refs ~ id, via repointPatternTagRefs - not
        // fetchPatternsWithTag's string match, since patterns.tags is
        // frozen and can no longer be trusted to find every pattern that
        // actually carries a given tag). A plain rename touches no patterns
        // at all - a renamed tags_v2 row keeps its own id, so every pattern
        // already pointing at it is still correct. mergedInstead means the
        // requested rename's target name already existed as a same-typed
        // tag, so syncSatelliteTablesForOp repointed everything at that
        // existing row and retired this one instead - a real merge, not a
        // no-op for patterns, even though the UI still asked for "rename".
        // repointPatternTagRefs runs server-side now (one request), not a
        // throttled per-pattern loop - there's no more mid-flight progress
        // to report, so this resolves straight to the final result.
        const { patternsAffected, mergedInstead } = await syncSatelliteTablesForOp(type, tag, newTag);
        const renamedInPlace = type === 'rename' && !mergedInstead;
        // invalidateQueries alone refetches each of these four - they're all
        // actively mounted on this page - so the refetchX() calls this block
        // used to also fire right alongside each one fired the same GET a
        // second time, doubling every request below to eight. This went
        // unnoticed on rename specifically because syncSatelliteTablesForOp
        // above used to throw before execution ever reached this far (see
        // the requestKey: null fixes added to it and its helpers) - now
        // that it actually completes, this block runs for real and the
        // doubled burst is what was tripping the rate limiter right after.
        invalidateTagSatelliteQueries();

        // A true in-place rename's own patternsAffected stays empty - on
        // purpose, no pattern was touched. For the admin log's own record
        // (an audit trail of how many patterns a tag reached, not a claim
        // about what this specific operation touched), fall back to this
        // tag's last-known usage count from the already-loaded tagStats
        // grid data instead of fetching patterns again just to count them.
        // A merge - requested as one, or a rename redirected into one -
        // already has the real count in patternsAffected.
        const loggedPatternCount = renamedInPlace
          ? (tagStats.find((s) => s.tag === tag)?.count ?? 0)
          : patternsAffected.length;

        setProgress((p) => ({
          ...p,
          done: true,
          total: patternsAffected.length,
          completed: patternsAffected.length,
          successMessage: renamedInPlace
            ? `"${tag}" renamed to "${newTag}" - no pattern records needed updating.`
            : undefined,
        }));

        const actionLabel = type === 'delete' ? 'Tag Deleted' : renamedInPlace ? 'Tag Renamed' : 'Tag Merged';
        log({
          action: actionLabel,
          entity_type: 'Tag',
          entity_id: tag,
          entity_name: tag,
          changes: newTag ? { tag: { from: tag, to: newTag } } : {},
          metadata: {
            number_of_affected_patterns: loggedPatternCount,
            type,
            merged_instead: !!mergedInstead,
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
    [queryClient, log, setIsFetchingPatterns, tagStats, invalidateTagSatelliteQueries],
  );

  const startOp = useCallback(
    async (type: OperationType, tag: string, newTag?: string) => {
      setIsFetchingPatterns(true);

      // tag_refs, not patterns.tags - the frozen string field can no longer
      // be trusted to find every pattern that actually carries this tag
      // (see fetchPatternsWithTagRef's own comment). Resolves the tag name
      // to its tags_v2 id first, the same type-blind lookup
      // syncSatelliteTablesForOp itself uses right before doing the real
      // work, so this confirmation preview counts the same patterns the
      // operation is actually about to touch.
      const tagV2Row = await findTagV2Record(tag);
      const records = tagV2Row ? await fetchPatternsWithTagRef(tagV2Row.id) : [];

      // For delete: warn about direct children that will become orphaned
      const childTags = type === 'delete' ? hierarchy.filter((h) => h.parent_tag === tag).map((h) => h.tag) : [];

      setPendingOp({ type, tag, newTag, affectedCount: records.length, childTags });
      setIsFetchingPatterns(false);
    },
    [hierarchy, setIsFetchingPatterns],
  );

  const startDeleteMany = useCallback(
    async (tags: string[]) => {
      // For bulk cleanup, sum affected records - fetched one at a time
      let total = 0;
      setIsFetchingPatterns(true);

      for (const t of tags) {
        const tagV2Row = await findTagV2Record(t);
        const records = tagV2Row ? await fetchPatternsWithTagRef(tagV2Row.id) : [];
        total += records.length;
        await sleep(BATCH_DELAY_MS);
      }

      setPendingOp({ type: 'delete', tag: `${tags.length} tags`, affectedCount: total });
      (window as any).__pendingDeleteTags = tags;
      setIsFetchingPatterns(false);
    },
    [setIsFetchingPatterns],
  );

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
        let totalPatternsAffected = 0;
        // Reuses syncSatelliteTablesForOp('delete', ...) per tag - the same
        // complete, tag_refs-based path the single-tag Delete button
        // already uses. The old version here only ever stripped the tag
        // string from patterns.tags directly: it couldn't find a pattern
        // tagged only through tag_refs, and even for the patterns it did
        // find, it left tag_refs, the tags_v2 row itself, and every
        // implied_tags/tag_aliases/tag_hierarchy reference untouched - a
        // tag "deleted" this way kept showing up in search and display.
        // Found via code review.
        for (const tag of tags) {
          const { patternsAffected } = await syncSatelliteTablesForOp('delete', tag);
          totalPatternsAffected += patternsAffected.length;
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
          metadata: { tags, affected_patterns: totalPatternsAffected },
        });
        queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_PAGINATED_QUERY_KEY });
        invalidateTagSatelliteQueries();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setProgress((p) => ({ ...p, error: msg }));
      }
    } else {
      await executeOperation({ type: op.type, tag: op.tag, newTag: op.newTag });
    }
  }, [pendingOp, executeOperation, queryClient, log, invalidateTagSatelliteQueries]);

  // ── Sync Ancestor Tags ─────────────────────────────────────────────────────
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);

  const runSyncAncestors = useCallback(async () => {
    setSyncConfirmOpen(false);

    const allPatterns: TypePatternRecord[] = [];
    let page = 1;
    while (true) {
      const result = await pocketbase
        .collection('patterns')
        .getList<TypePatternRecord>(page, 500, { fields: 'id,tag_refs' });
      allPatterns.push(...result.items);
      if (allPatterns.length >= result.totalItems) break;
      page++;
    }

    // Reads tag_refs, not patterns.tags - the frozen string field has
    // nothing in it for a pattern tagged since tag-entry moved to
    // tag_refs-only, so this would silently stop seeing (and fixing) any
    // pattern tagged after that cutover. tag_hierarchy itself is still
    // name-keyed (see its own comment above - retiring it is a later
    // cleanup), so tagsV2ById turns each ref id back into the name
    // getAncestors needs.
    const candidates = allPatterns
      .map((p) => {
        const currentRefs = p.tag_refs ?? [];
        const currentNames = currentRefs.map((id) => tagsV2ById.get(id)?.tag).filter((t): t is string => !!t);
        const currentNameSet = new Set(currentNames);
        const missingAncestors = new Set<string>();
        for (const name of currentNames) {
          for (const ancestor of getAncestors(name, hierarchy)) {
            if (!currentNameSet.has(ancestor)) missingAncestors.add(ancestor);
          }
        }
        return { id: p.id, currentRefs, missingAncestors: [...missingAncestors] };
      })
      .filter((p) => p.missingAncestors.length > 0);

    if (candidates.length === 0) {
      setToast('All patterns already have up-to-date parent tags.');
      return;
    }

    setProgress({
      open: true,
      title: `Syncing parent tags across ${candidates.length} patterns…`,
      completed: 0,
      total: candidates.length,
      done: false,
    });

    try {
      setIsFetchingPatterns(true);

      await processSequentially(
        candidates,
        async (candidate) => {
          // resolveOrCreateTagRefs finds each ancestor's existing tags_v2
          // row, or creates a General-type one - same resolution every
          // other tag-entry save path already uses.
          const missingIds = await resolveOrCreateTagRefs(candidate.missingAncestors);
          const newRefs = [...new Set([...candidate.currentRefs, ...missingIds])];
          await pocketbase.collection('patterns').update(candidate.id, { tag_refs: newRefs });
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
        metadata: { patterns_updated: candidates.length },
      });
      queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_PAGINATED_QUERY_KEY });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setProgress((p) => ({ ...p, error: msg }));
    } finally {
      setIsFetchingPatterns(false);
    }
  }, [hierarchy, queryClient, log, setIsFetchingPatterns, tagsV2ById]);

  const uniqueTagCount = tagStats.length;
  const totalTagUsages = tagStats.reduce((s, t) => s + t.count, 0);
  // 0 until tag_usage's view query is updated to a LEFT JOIN - see the
  // "Add Tag dialog" section above. Harmless either way: this just reads 0
  // unused tags until then, and starts counting for real the moment that
  // view change lands, with no further code change needed here.
  const unusedTagCount = tagStats.filter((t) => t.count === 0).length;

  // Jumps straight to any unused tags instead of leaving an admin to hunt
  // for them on the last page of the default "most-used first" sort, or
  // behind the default General-only type filter (see didSetDefaultTypeFilter
  // above) if the tag they're after was created under a different Type.
  const handleShowUnusedTags = useCallback(() => {
    setTagViewMode('list');
    setTagTypeFilter('');
    setTagSearch('');
    setTagSortModel([{ field: 'count', sort: 'asc' }]);
    setTagPaginationModel((prev) => ({ ...prev, page: 0 }));
  }, []);

  // ── DataGrid column definitions ────────────────────────────────────────────
  const tagColumns = useMemo(
    () =>
      buildTagColumns({
        hierarchy,
        tagsV2ById,
        aliasByOwnName,
        aliasesByTarget,
        impliesByTag,
        impliedByTag,
        setMetadataRow,
        setImpliedTagsRow,
        setAliasRow,
        setSetParentRow,
        setRenamePrefill,
        startOp,
      }),
    [hierarchy, startOp, tagsV2ById, aliasByOwnName, aliasesByTarget, impliesByTag, impliedByTag],
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
              <Tooltip title="Sort the list below by fewest patterns first, so any unused tag sorts to the top">
                <Chip
                  label={`${unusedTagCount.toLocaleString()} unused tags`}
                  color="info"
                  variant="outlined"
                  size="small"
                  onClick={handleShowUnusedTags}
                />
              </Tooltip>
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

        {tagViewMode === 'list' && (
          <TextField
            select
            label="Tag Type"
            value={tagTypeFilter}
            onChange={(e) => setTagTypeFilter(e.target.value)}
            size="small"
            sx={{ width: 180 }}
          >
            <MenuItem value="">All types</MenuItem>
            {tagTypesList.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>
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
          <ToggleButton value="graph">
            <Tooltip title="Graph view (implied tags)">
              <DeviceHubIcon fontSize="small" />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        {tagViewMode === 'list' && (
          <Button size="small" onClick={() => refetchTagPage()} variant="outlined" color="inherit">
            Refresh
          </Button>
        )}

        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() => setAddTagOpen(true)}
        >
          Add Tag
        </Button>

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

      {/* Graph view - read-only, but not inert: clicking a tag node reuses
          the existing Implied Tags dialog rather than a new one. */}
      {tagViewMode === 'graph' && (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <TagGraphView
            tagsV2={tagsV2List}
            impliedTags={impliedTagsList}
            aliases={tagAliasesList}
            tagTypes={tagTypesList}
            onNodeClick={handleTagGraphNodeClick}
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
        existingRecord={metadataRow ? (tagsV2ById.get(metadataRow.id) ?? null) : null}
        tagTypes={tagTypesList}
        onClose={() => setMetadataRow(null)}
        onSaved={handleMetadataSaved}
      />

      {/* Add Tag Dialog */}
      <AddTagDialog
        open={addTagOpen}
        tagTypes={tagTypesList}
        onClose={() => setAddTagOpen(false)}
        onSaved={handleTagCreated}
      />

      {/* Implied Tags Dialog */}
      <ImpliedTagsDialog
        open={!!impliedTagsRow}
        tag={impliedTagsRow}
        impliedTags={impliedTagsList}
        onClose={() => setImpliedTagsRow(null)}
        onSaved={handleImpliedTagsSaved}
      />

      {/* Alias Dialog */}
      <AliasDialog
        open={!!aliasRow}
        tag={aliasRow}
        aliases={tagAliasesList}
        onClose={() => setAliasRow(null)}
        onSaved={handleAliasSaved}
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
        successMessage={progress.successMessage}
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
        <RenamePanel tagStats={tagStats} onRename={(from, to) => startOp('rename', from, to)} prefill={renamePrefill} />
      </Box>

      <Box sx={{ mb: 3 }}>
        <CleanupPanel tagStats={tagStats} onDeleteMany={startDeleteMany} />
      </Box>
    </>
  );
};
