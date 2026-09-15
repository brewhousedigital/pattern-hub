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
  useQueryGetImpliedTags,
  useQueryGetAllTagAliases,
  getTagsImplying,
  escapeTagFilterValue,
  findTagV2Record,
  isSlugTaken,
  uniqueSlugFor,
  resolveOrCreateTagV2Row,
  resolveOrCreateTagRefs,
  TAGS_V2_QUERY_KEY,
  IMPLIED_TAGS_QUERY_KEY,
  TAG_ALIASES_QUERY_KEY,
  type TypeTagStat,
  type TypePatternRecord,
  type TypeTagHierarchyRecord,
  type TypeTagV2Record,
  type TypeTagTypeRecord,
  type TypeImpliedTagRecord,
  type TypeTagAliasRecord,
} from '@/functions/database/tags';
import { useQueryAdminUsersPaginated, useQueryGetUserById } from '@/functions/database/users';
import { processSequentially } from '@/functions/utilities/batch-write';
import { slugifyTag } from '@/functions/utilities/slugify-tag';
import { normalizeTagName } from '@/functions/utilities/normalize-tag';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { useAdminLogger } from '@/functions/database/admin-logs';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { GenericMarkdownEditor } from '@/components/admin/GenericMarkdownEditor';
import { TagGraphView } from '@/components/admin/TagGraphView';
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
import DeviceHubIcon from '@mui/icons-material/DeviceHub';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

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

/**
 * Fetch ALL patterns whose tag_refs contains a specific tags_v2 id - the
 * id-based equivalent of fetchPatternsWithTag above. Uses the same
 * `~`-on-a-multi-relation-column idiom already proven live for
 * patterns.authors (`authors ~ id`), not a quote-wrapped match - ids are
 * opaque, fixed-length strings, not human text a substring match could
 * accidentally over-match the way a tag name could.
 *
 * This is not just a faster version of fetchPatternsWithTag - patterns.tags
 * is frozen, so a string search can no longer find every pattern that
 * actually carries a given tag. A tag added through a normal edit reaches
 * tag_refs only, never patterns.tags, so fetchPatternsWithTag would
 * silently miss it.
 */
async function fetchPatternsWithTagRef(tagId: string): Promise<TypePatternRecord[]> {
  const records: TypePatternRecord[] = [];
  let page = 1;
  const perPage = 500;

  while (true) {
    const result = await pocketbase
      .collection('patterns')
      .getList<TypePatternRecord>(page, perPage, { filter: `tag_refs ~ '${tagId}'`, fields: 'id,tag_refs,name' });
    records.push(...result.items);
    if (records.length >= result.totalItems) break;
    page++;
  }

  return records;
}

/**
 * Repoints (merge) or removes (delete) a tags_v2 id across every pattern's
 * tag_refs. Pass a real `toId` to swap `fromId`
 * for it (deduping if a pattern already carried both - merge's case); pass
 * `null` to just remove `fromId` (delete's case, no replacement).
 *
 * Only relies on processSequentially's own built-in delay between items,
 * not an additional sleep inside the per-item callback the way the old
 * string-based pattern-rewrite loop did (found via code review while
 * building this: that loop called `await sleep(BATCH_DELAY_MS)` inside a
 * processSequentially callback that already sleeps `delayMs` - 3000ms by
 * default, the same value BATCH_DELAY_MS holds - between every item on its
 * own, so every merge/delete has been waiting twice as long as intended,
 * per pattern, since this loop was first written. Not reproduced here.
 *
 * Returns the affected patterns (id + name) so the caller can still build
 * an accurate admin-log entry without a second fetch.
 */
async function repointPatternTagRefs(
  fromId: string,
  toId: string | null,
  onProgress?: (completed: number, total: number) => void,
): Promise<{ id: string; name: string }[]> {
  const records = await fetchPatternsWithTagRef(fromId);
  const affected: { id: string; name: string }[] = [];

  await processSequentially(
    records,
    async (record) => {
      affected.push({ id: record.id, name: record.name || '' });
      const without = (record.tag_refs ?? []).filter((id) => id !== fromId);
      const updated = toId && !without.includes(toId) ? [...without, toId] : without;
      await pocketbase.collection('patterns').update(record.id, { tag_refs: updated });
    },
    onProgress,
  );

  return affected;
}

// processSequentially (batch-with-delay writes) now lives in
// src/functions/utilities/batch-write.ts, imported above - see that file's
// doc comment. `sleep`/`BATCH_DELAY_MS` above stay local: a few call sites
// below use them directly for a standalone delay, outside of any
// processSequentially batch.

// ─── tags_v2 lookup + slug helpers ─────────────────────────────────────────────
//
// tags_v2 is the canonical tag-metadata table - a row here holds a tag's
// Type, Definition, and disambiguation note. syncSatelliteTablesForOp below
// keeps it in sync with tag_hierarchy whenever an admin renames, merges, or
// deletes a tag, so those satellite fields never silently detach from the
// live tag string. Uses the full TypeTagV2Record imported from
// functions/database/tags.ts (the same type the metadata dialog below
// reads/writes) rather than a narrower local shape.

// findTagV2Record/isSlugTaken/uniqueSlugFor/resolveOrCreateTagV2Row now all
// live in functions/database/tags.ts, so resolveOrCreateTagRefs there can
// share them too - imported above instead of defined here.

// ─── implied_tags / tag_aliases sync helpers ───────────────────────────────────
//
// Re-points every implied_tags edge mentioning `oldTag` (on either side) to
// mention `newTag` instead. Used for both rename and merge - from this
// table's perspective the two have the same effect: oldTag stops existing
// as a distinct tag, and every fact recorded about it should transfer to
// newTag rather than vanish. Skips (deletes, rather than creating) an edge
// that would become a self-loop (newTag implies newTag) or a duplicate of
// an edge newTag already has - both are meaningless once merged, and the
// unique index on (tag, implies_tag) would reject the duplicate anyway.
//
// newTagId is optional, merge-only. A rename never
// needs it - the underlying tags_v2 row keeps its own id, so tag_ref/
// implies_tag_ref already point at the right row and don't need touching.
// A merge does change which row an edge should point at (the source row
// gets deleted), so the caller passes the target's real id there, and this
// sets it in the SAME update call as the string retarget - not a second,
// separate pass over these rows, which could race against this function's
// own delete-on-self-loop/duplicate branches below (a second pass trying
// to update a row this pass just deleted would fail outright).
async function retargetImpliedTagEdges(oldTag: string, newTag: string, newTagId?: string) {
  // A rename/merge where the tag didn't actually change (oldTag and newTag
  // normalize to the same string - a case-only edit, say) has nothing to
  // retarget. Without this guard, the query below for "every edge already
  // touching newTag" is identical to "every edge touching oldTag", so every
  // edge in outgoing/incoming would incorrectly look like a pre-existing
  // duplicate of itself and get deleted - silently wiping the tag's whole
  // implied-tags graph. Found and fixed via code review.
  if (oldTag === newTag) return;

  const oldSafe = escapeTagFilterValue(oldTag);
  const newSafe = escapeTagFilterValue(newTag);
  const [outgoingRaw, incomingRaw, newTagEdges] = await Promise.all([
    pocketbase.collection('implied_tags').getFullList<TypeImpliedTagRecord>({ filter: `tag = "${oldSafe}"` }),
    pocketbase.collection('implied_tags').getFullList<TypeImpliedTagRecord>({ filter: `implies_tag = "${oldSafe}"` }),
    pocketbase
      .collection('implied_tags')
      .getFullList<TypeImpliedTagRecord>({ filter: `tag = "${newSafe}" || implies_tag = "${newSafe}"` }),
  ]);

  // A self-loop row (tag === implies_tag === oldTag) matches both queries
  // above as two separate snapshots of the same record. Handle it once,
  // here, by deleting it outright - a tag implying itself is never
  // meaningful, rename or not - rather than letting the two loops below
  // each independently update their own stale copy and resurrect it as a
  // self-loop under the new name.
  const selfLoopIds = new Set(outgoingRaw.filter((e) => e.implies_tag === oldTag).map((e) => e.id));
  for (const id of selfLoopIds) {
    await pocketbase.collection('implied_tags').delete(id);
  }
  const outgoing = outgoingRaw.filter((e) => !selfLoopIds.has(e.id));
  const incoming = incomingRaw.filter((e) => !selfLoopIds.has(e.id));

  const existingEdgeKeys = new Set(newTagEdges.map((e) => `${e.tag} ${e.implies_tag}`));

  for (const edge of outgoing) {
    const key = `${newTag} ${edge.implies_tag}`;
    if (edge.implies_tag === newTag || existingEdgeKeys.has(key)) {
      await pocketbase.collection('implied_tags').delete(edge.id);
    } else {
      await pocketbase
        .collection('implied_tags')
        .update(edge.id, newTagId ? { tag: newTag, tag_ref: newTagId } : { tag: newTag });
      existingEdgeKeys.add(key);
    }
  }
  for (const edge of incoming) {
    const key = `${edge.tag} ${newTag}`;
    if (edge.tag === newTag || existingEdgeKeys.has(key)) {
      await pocketbase.collection('implied_tags').delete(edge.id);
    } else {
      await pocketbase
        .collection('implied_tags')
        .update(edge.id, newTagId ? { implies_tag: newTag, implies_tag_ref: newTagId } : { implies_tag: newTag });
      existingEdgeKeys.add(key);
    }
  }
}

async function deleteImpliedTagEdgesFor(deletedTag: string) {
  const safe = escapeTagFilterValue(deletedTag);
  const edges = await pocketbase
    .collection('implied_tags')
    .getFullList<TypeImpliedTagRecord>({ filter: `tag = "${safe}" || implies_tag = "${safe}"` });
  for (const edge of edges) {
    await pocketbase.collection('implied_tags').delete(edge.id);
  }
}

// Same substitution principle as retargetImpliedTagEdges, for tag_aliases.
// `target_tag` has no unique constraint (many aliases can share a root), so
// re-pointing every alias that pointed at oldTag is unconditional. `alias`
// does have a unique constraint - if newTag is already registered as some
// other alias, that's a real conflict, not something to silently resolve,
// so the old row is left as-is for an admin to sort out by hand, the same
// "flag for review" principle used elsewhere for an author-name collision.
// newTagId is optional, merge-only, same reasoning as
// retargetImpliedTagEdges's own newTagId parameter. Only ever applied to the
// asTarget loop below - target_tag_ref exists because a target is always a
// real tag, but alias itself never gets a ref field (deliberately: an alias
// like "orca" is allowed to have no tags_v2 row of its own), so the
// asAlias loop has nothing to repoint regardless of rename or merge.
async function retargetTagAliases(oldTag: string, newTag: string, newTagId?: string) {
  if (oldTag === newTag) return; // see retargetImpliedTagEdges - nothing changed, nothing to retarget

  const oldSafe = escapeTagFilterValue(oldTag);
  const [asAliasRaw, asTargetRaw] = await Promise.all([
    pocketbase.collection('tag_aliases').getFullList<TypeTagAliasRecord>({ filter: `alias = "${oldSafe}"` }),
    pocketbase.collection('tag_aliases').getFullList<TypeTagAliasRecord>({ filter: `target_tag = "${oldSafe}"` }),
  ]);

  // A row aliased to itself (alias === target_tag === oldTag) matches both
  // queries above as two separate snapshots of the same record - same
  // self-reference hazard as retargetImpliedTagEdges above. Handle it once,
  // here, by deleting it outright, rather than letting both loops below
  // process their own stale copy and resurrect it as a self-alias under
  // the new name.
  const selfAliasIds = new Set(asAliasRaw.filter((r) => r.target_tag === oldTag).map((r) => r.id));
  for (const id of selfAliasIds) {
    await pocketbase.collection('tag_aliases').delete(id);
  }
  const asAlias = asAliasRaw.filter((r) => !selfAliasIds.has(r.id));
  const asTarget = asTargetRaw.filter((r) => !selfAliasIds.has(r.id));

  for (const row of asTarget) {
    if (row.alias === newTag) {
      // Would become a no-op self-reference (newTag aliased to itself) -
      // same guard the asAlias loop below already had; this loop was
      // missing it (found via code review).
      await pocketbase.collection('tag_aliases').delete(row.id);
      continue;
    }
    await pocketbase
      .collection('tag_aliases')
      .update(row.id, newTagId ? { target_tag: newTag, target_tag_ref: newTagId } : { target_tag: newTag });
  }
  for (const row of asAlias) {
    if (row.target_tag === newTag) {
      // Would become a no-op self-reference (newTag aliased to itself).
      await pocketbase.collection('tag_aliases').delete(row.id);
      continue;
    }
    const conflict = await pocketbase
      .collection('tag_aliases')
      .getFirstListItem(`alias = "${escapeTagFilterValue(newTag)}"`)
      .catch(() => null);
    if (conflict) continue; // leave for manual review - see comment above
    await pocketbase.collection('tag_aliases').update(row.id, { alias: newTag });
  }
}

async function deleteTagAliasesFor(deletedTag: string) {
  const safe = escapeTagFilterValue(deletedTag);
  const rows = await pocketbase
    .collection('tag_aliases')
    .getFullList<TypeTagAliasRecord>({ filter: `alias = "${safe}" || target_tag = "${safe}"` });
  for (const row of rows) {
    await pocketbase.collection('tag_aliases').delete(row.id);
  }
}

// ─── Satellite-table sync ──────────────────────────────────────────────────────
//
// Always fetches fresh records from PocketBase so stale React Query cache
// can never cause a missed update. Called for every rename / merge / delete
// operation. Keeps five things in sync with the tag string itself - four
// satellite tables, plus patterns.tag_refs directly, since a merge or
// delete can change or remove which tags_v2 row a pattern's own tag_refs
// should point at:
//
//   tag_hierarchy (parent/child, superseded by the implied-tags graph below
//   but still kept in sync, since the admin hierarchy editor still reads it):
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
//     merge   - carries the source's slug (and its own previous_slugs) into
//               the target's previous_slugs, creating a minimal target row
//               first if one doesn't exist yet, then deletes the source
//               row - preserving the same redirect-instead-of-404 guarantee
//               rename gets, without transferring Type/Definition (the two
//               tags may not actually mean the same thing, so only the URL
//               history carries over, not the content). Every id reference
//               to the source row - patterns.tag_refs, and implied_tags/
//               tag_aliases' ref fields - is repointed to the target BEFORE
//               this delete runs, never after or concurrently with it; a
//               dangling reference to an id that no longer exists is a real
//               hazard this order exists specifically to avoid.
//     delete  - repoints (see above) removes the id from every referencing
//               row first, same ordering reasoning as merge, then deletes
//               the row.
//
//   patterns.tag_refs:
//     rename  - untouched. The tags_v2 row keeps its own id when renamed,
//               so every pattern already pointing at it is still correct.
//     merge   - every pattern found via tag_refs ~ sourceId gets the source
//               id swapped for the target's (deduped, in case a pattern
//               already carried both).
//     delete  - every pattern found via tag_refs ~ deletedId gets that id
//               removed, no replacement.
//
//   implied_tags (the multi-parent graph - see the helpers above):
//     rename  - retargets every edge's tag/implies_tag string mentioning the
//               old name to the new one. Never touches tag_ref/
//               implies_tag_ref - see retargetImpliedTagEdges' own comment
//               on why a rename never needs to.
//     merge   - same string retarget as rename, plus (unlike rename)
//               repoints tag_ref/implies_tag_ref from the source id to the
//               target's, in the same update call - see
//               retargetImpliedTagEdges' own comment.
//     delete  - removes every edge mentioning the deleted tag outright (both
//               string and id fields go with the row - nothing is left to
//               go stale).
//
//   tag_aliases (see the helpers above):
//     rename  - retargets every alias/target_tag string reference to the new
//               name. Same as implied_tags: never touches target_tag_ref -
//               a rename never needs to.
//     merge   - same string retarget as rename, plus repoints
//               target_tag_ref from the source id to the target's.
//     delete  - removes every alias/target reference to the deleted tag
//               outright, same reasoning as implied_tags' delete case.
//
// Returns the patterns a merge or delete's tag_refs repoint actually
// touched (id + name), so the caller can build an accurate admin-log entry
// without a second fetch. Always empty for rename, which touches no
// patterns at all.
async function syncSatelliteTablesForOp(
  type: OperationType,
  tag: string,
  newTag?: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<{ patternsAffected: { id: string; name: string }[] }> {
  // normalizeTagName (not a local .toLowerCase().trim()) so this always
  // agrees with what every pattern-save path stores - collapsing internal
  // whitespace too, not just casing. Found via code review: the old local
  // normalization let a tag with doubled internal spaces fork into a clean
  // form in patterns.tags and a stale, never-matching tags_v2 row.
  const safe = normalizeTagName(tag);
  const safeFilter = escapeTagFilterValue(safe);

  const [ownRecord, childRecords, tagV2Record] = await Promise.all([
    pocketbase
      .collection('tag_hierarchy')
      .getFirstListItem<TypeTagHierarchyRecord>(`tag = "${safeFilter}"`)
      .catch(() => null),
    pocketbase
      .collection('tag_hierarchy')
      .getFullList<TypeTagHierarchyRecord>({ filter: `parent_tag = "${safeFilter}"` }),
    findTagV2Record(safe),
  ]);

  if (type === 'rename' && newTag) {
    const safeNew = normalizeTagName(newTag);
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
    await retargetImpliedTagEdges(safe, safeNew);
    await retargetTagAliases(safe, safeNew);
    return { patternsAffected: [] };
  } else if (type === 'merge' && newTag) {
    const safeNew = normalizeTagName(newTag);
    // Merging a tag into itself (the same normalized name - a case-only
    // "merge," say) is meaningless, the same guard retargetImpliedTagEdges/
    // retargetTagAliases already apply. Without it, the tags_v2 branch
    // below would find its own row as `targetRecord`, update it, then
    // immediately delete that same row (tagV2Record.id === targetRecord.id)
    // as its own "source" cleanup - meaningfully worse now that patterns
    // reference tags by id: every pattern's tag_refs would get "repointed"
    // to the id of the row that just got deleted out from under it, going
    // dangling. RenameOrMergePanel's own canSubmit (see below) already
    // disables the button for this input, so this specific trigger isn't
    // reachable through the live admin UI today - this guard is defense in
    // depth, not a fix for a reachable path, and stays regardless in case a
    // future caller of this function doesn't carry the same UI-level guard.
    if (safe === safeNew) return { patternsAffected: [] };
    if (ownRecord) {
      await pocketbase.collection('tag_hierarchy').delete(ownRecord.id);
    }
    for (const child of childRecords) {
      await pocketbase.collection('tag_hierarchy').update(child.id, { parent_tag: safeNew });
    }

    let patternsAffected: { id: string; name: string }[] = [];
    if (tagV2Record) {
      const carriedSlugs = [tagV2Record.slug, ...tagV2Record.previous_slugs];
      const targetRecord = await findTagV2Record(safeNew);
      let targetId: string;
      if (targetRecord) {
        await pocketbase.collection('tags_v2').update(targetRecord.id, {
          previous_slugs: [...new Set([...targetRecord.previous_slugs, ...carriedSlugs])],
        });
        targetId = targetRecord.id;
      } else {
        const baseSlug = slugifyTag(safeNew);
        const targetSlug = baseSlug ? await uniqueSlugFor(baseSlug, '') : safeNew;
        const created = await pocketbase
          .collection('tags_v2')
          .create<TypeTagV2Record>({ tag: safeNew, slug: targetSlug, previous_slugs: [...new Set(carriedSlugs)] });
        targetId = created.id;
      }

      // Every id reference to the source row must be repointed to targetId
      // before the source row is deleted below - see this function's own
      // doc comment.
      patternsAffected = await repointPatternTagRefs(tagV2Record.id, targetId, onProgress);
      await retargetImpliedTagEdges(safe, safeNew, targetId);
      await retargetTagAliases(safe, safeNew, targetId);

      await pocketbase.collection('tags_v2').delete(tagV2Record.id);
    } else {
      await retargetImpliedTagEdges(safe, safeNew);
      await retargetTagAliases(safe, safeNew);
    }
    return { patternsAffected };
  } else if (type === 'delete') {
    if (ownRecord) {
      await pocketbase.collection('tag_hierarchy').delete(ownRecord.id);
    }
    for (const child of childRecords) {
      await pocketbase.collection('tag_hierarchy').delete(child.id);
    }

    let patternsAffected: { id: string; name: string }[] = [];
    if (tagV2Record) {
      // Same ordering discipline as merge: every pattern's tag_refs loses
      // this id before the tags_v2 row itself is deleted.
      patternsAffected = await repointPatternTagRefs(tagV2Record.id, null, onProgress);
      await pocketbase.collection('tags_v2').delete(tagV2Record.id);
    }
    await deleteImpliedTagEdgesFor(safe);
    await deleteTagAliasesFor(safe);
    return { patternsAffected };
  }

  return { patternsAffected: [] };
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
  /**
   * Overrides the default "{completed} record(s) updated" success text. A
   * rename no longer touches any pattern record at all, so "0 records
   * updated" would read as if nothing happened rather than as the
   * (correct, and now much faster) outcome it actually is.
   */
  successMessage?: string;
}

function ProgressDialog({ open, title, completed, total, done, error, onClose, successMessage }: ProgressDialogProps) {
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
            {successMessage ?? `Operation complete - ${completed} record${completed !== 1 ? 's' : ''} updated.`}
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
        Rename <strong>"{tag}"</strong> → <strong>"{newTag}"</strong>. {affectedCount} pattern
        {affectedCount !== 1 ? 's currently use' : ' currently uses'} this tag.
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
// Edits a tag's tags_v2 row (Type, Definition, disambiguation note). Most
// tags already have a row by the time an admin opens this, via the
// backfill or the /api/sync-tag-catalog cron - but a just-typed tag that
// hasn't synced yet won't, so this creates one on first save rather than
// assuming it exists.

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

  // Account linking, shown only when this tag's Type is "Author" - an
  // admin-only linking tool, instead of a self-service "claim my author
  // credit" flow.
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userSearchInput, setUserSearchInput] = useState('');
  const debouncedUserSearch = useDebounce(userSearchInput, 400);
  const { data: userSearchData, isFetching: userSearchFetching } = useQueryAdminUsersPaginated({
    page: 0,
    pageSize: 20,
    search: debouncedUserSearch,
    verifiedFilter: 'all',
    bannedFilter: 'all',
  });
  // Resolves the currently-linked account's own name/email even when it
  // isn't in the current search result page - e.g. right after the dialog
  // opens, before the admin has typed a search. Mirrors the same
  // fallback-to-a-dedicated-fetch shape FancyAutocompleteAuthors already
  // uses for its own preselected values.
  const { data: linkedUserDetail } = useQueryGetUserById(selectedUserId || undefined);

  const selectedType = tagTypes.find((t) => t.id === selectedTypeId) ?? null;
  const isAuthorType = selectedType?.name === 'Author';
  const selectedUserOption =
    (userSearchData?.items ?? []).find((u) => u.id === selectedUserId) ??
    (linkedUserDetail && linkedUserDetail.id === selectedUserId ? linkedUserDetail : null);

  // Pre-fill from the existing row (if any) whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setSelectedTypeId(existingRecord?.type ?? '');
      setDefinition(existingRecord?.definition ?? '');
      setDisambiguationNote(existingRecord?.disambiguation_note ?? '');
      setSelectedUserId(existingRecord?.linked_user ?? '');
      setUserSearchInput('');
      setError(null);
    }
  }, [open, existingRecord]);

  const handleSave = async () => {
    if (!tag) return;
    setSaving(true);
    setError(null);
    try {
      // At most one tag may carry a given user's id - enforced here, not as
      // a database constraint. A stale link left over from switching this
      // tag's Type away from Author and back is cleared below by the
      // isAuthorType ? ... : '' fallback, same as it always was for a
      // brand-new pick.
      if (isAuthorType && selectedUserId) {
        const conflict = await pocketbase
          .collection('tags_v2')
          .getFirstListItem<TypeTagV2Record>(
            `linked_user = "${escapeTagFilterValue(selectedUserId)}" && id != "${escapeTagFilterValue(existingRecord?.id ?? '')}"`,
          )
          .catch(() => null);
        if (conflict) {
          setError(`This account is already linked to the tag "${conflict.tag}". Unlink it there first.`);
          setSaving(false);
          return;
        }
      }

      const payload = {
        type: selectedTypeId,
        definition,
        disambiguation_note: disambiguationNote,
        linked_user: isAuthorType ? selectedUserId : '',
      };

      if (existingRecord) {
        await pocketbase.collection('tags_v2').update(existingRecord.id, payload);
      } else {
        const baseSlug = slugifyTag(tag.tag);
        if (!baseSlug) {
          // Matches the "skip and flag for manual review" handling the
          // backfill script and /api/sync-tag-catalog both use for this
          // same edge case, instead of the un-checked raw-string fallback
          // this used to have here (found via code review) - a tag made
          // entirely of punctuation has no safe, uniqueness-checked slug to
          // give it, so
          // this stops short of creating a row rather than guessing one.
          setError(
            `"${tag.tag}" has no letters or numbers, so it can't be given a URL-safe slug. This tag needs to be renamed before it can have a Type or Definition.`,
          );
          setSaving(false);
          return;
        }
        // '' as excludeId is safe here - no real record ever has an empty
        // id, so `id != ""` (inside isSlugTaken) matches every existing row,
        // exactly the "don't exclude anything" behavior a brand-new record
        // needs.
        const slug = await uniqueSlugFor(baseSlug, '');
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
          linked_user: { from: existingRecord?.linked_user || null, to: payload.linked_user || null },
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

        {isAuthorType && (
          <Box sx={{ py: 1 }}>
            <Autocomplete
              options={userSearchData?.items ?? []}
              value={selectedUserOption}
              onChange={(_, v) => setSelectedUserId(v?.id ?? '')}
              getOptionLabel={(option) => option.name || option.email || option.id}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              loading={userSearchFetching}
              filterOptions={(x) => x}
              inputValue={userSearchInput}
              onInputChange={(_, v) => setUserSearchInput(v)}
              noOptionsText={userSearchInput ? 'No accounts found' : 'Type to search accounts'}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Linked account"
                  size="small"
                  placeholder="Search by name or email"
                  helperText="Sends this author's page to the account's real profile. Leave blank for an author with no account."
                />
              )}
            />
          </Box>
        )}

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

// ─── Implied Tags Dialog ─────────────────────────────────────────────────────────
//
// Manages implied_tags edges for one tag. Unlike SetParentDialog above, a
// tag can have any number of "implies" targets here, so this is an
// add/remove chip list rather than a single Autocomplete value.

interface ImpliedTagsDialogProps {
  open: boolean;
  tag: TypeReadOnlyDatabaseItem | null;
  impliedTags: TypeImpliedTagRecord[];
  onClose: () => void;
  onSaved: () => void;
}

function ImpliedTagsDialog({ open, tag, impliedTags, onClose, onSaved }: ImpliedTagsDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const debouncedSearch = useDebounce(inputValue, 400);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { log } = useAdminLogger();

  // Reprimes on open, matching SetParentDialog/TagMetadataDialog - without
  // this, the dialog stays mounted between rows (only `open` toggles), so a
  // leftover search term or error from a previous tag's session would
  // otherwise still be showing the next time this opens for a different tag
  // (found via code review).
  useEffect(() => {
    if (open) {
      setInputValue('');
      setError(null);
    }
  }, [open, tag]);

  const { data: searchData, isFetching: searchFetching } = useQueryAdminTagStatsPaginated({
    page: 0,
    pageSize: 50,
    search: debouncedSearch,
    sortField: 'count',
    sortDir: 'desc',
  });

  const outgoing = useMemo(() => (tag ? impliedTags.filter((e) => e.tag === tag.tag) : []), [tag, impliedTags]);
  const incoming = useMemo(() => (tag ? impliedTags.filter((e) => e.implies_tag === tag.tag) : []), [tag, impliedTags]);

  // Excludes self, anything already a direct target, and anything that
  // would create a cycle - a tag that already (even transitively) implies
  // this one, since adding it as a new target here would loop back.
  const options = useMemo(() => {
    if (!tag) return [];
    const alreadyImplied = new Set(outgoing.map((e) => e.implies_tag));
    const wouldCycle = new Set(getTagsImplying(tag.tag, impliedTags));
    return (searchData?.items ?? [])
      .map((item) => String(item.tag))
      .filter((name) => name !== tag.tag && !alreadyImplied.has(name) && !wouldCycle.has(name));
  }, [tag, outgoing, impliedTags, searchData]);

  // target may be a freely-typed string with no tags_v2 row yet - e.g. "bug"
  // has never been used on a published pattern, so it can't appear in
  // `options` (drawn from the tags view, which only lists tags already in
  // use). freeSolo on the Autocomplete below lets an admin commit it anyway;
  // this creates its tags_v2 row (General type, the same default every tag
  // starts with) in the same action, so it isn't left dangling with no
  // catalog identity until some pattern eventually carries it and
  // /api/sync-tag-catalog catches up.
  //
  // A freeSolo commit also bypasses the exclusions `options` normally
  // enforces by simply not listing them (self, already-implied, cycle-
  // causing) - re-checked explicitly here so typing one directly can't slip
  // past them the way selecting one from the dropdown never could.
  const handleAdd = async (rawTarget: string) => {
    if (!tag) return;
    const target = normalizeTagName(rawTarget);
    if (!target) return;
    if (target === tag.tag) {
      setError("A tag can't imply itself.");
      return;
    }
    if (outgoing.some((e) => e.implies_tag === target)) {
      setError(`"${tag.tag}" already implies "${target}".`);
      return;
    }
    if (getTagsImplying(tag.tag, impliedTags).includes(target)) {
      setError(`"${target}" already (directly or indirectly) implies "${tag.tag}" - adding it here would create a cycle.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const targetResolved = await resolveOrCreateTagV2Row(target);
      // The source side (this dialog's own tag) uses tag.id directly, not a
      // re-resolve-by-name. `tag` comes from the admin grid, backed by
      // tag_usage - its id IS the real, stable tags_v2 id for this specific
      // row. Re-resolving by name instead - resolveOrCreateTagV2Row(tag.tag)
      // - would risk landing on a DIFFERENT row than the one this dialog is
      // actually open for, whenever two rows share a name (e.g. "autumn"
      // the season and "autumn" the artist): resolveOrCreateTagV2Row
      // prefers a General-type row when one exists, which is exactly wrong
      // if this dialog is open for a non-General one. A correctness fix,
      // not a performance one - caught while preparing to actually rename
      // a tag whose name collided with another, not from a live report.
      const sourceId = tag.id;

      await pocketbase.collection('implied_tags').create({
        tag: tag.tag,
        implies_tag: target,
        tag_ref: sourceId,
        implies_tag_ref: targetResolved.row.id,
      });
      log({
        action: 'Implied Tag Added',
        entity_type: 'Tag',
        entity_id: tag.tag,
        entity_name: tag.tag,
        changes: { implies: { from: null, to: target } },
        metadata: targetResolved.created ? { created_new_tag: target } : {},
      });
      setInputValue('');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (edge: TypeImpliedTagRecord) => {
    setSaving(true);
    setError(null);
    try {
      await pocketbase.collection('implied_tags').delete(edge.id);
      log({
        action: 'Implied Tag Removed',
        entity_type: 'Tag',
        entity_id: tag?.tag ?? '',
        entity_name: tag?.tag ?? '',
        changes: { implies: { from: edge.implies_tag, to: null } },
        metadata: {},
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <DeviceHubIcon color="primary" fontSize="small" />
        Implied Tags for "{tag?.tag}"
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          "{tag?.tag}" implies:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2, minHeight: 32 }}>
          {outgoing.length === 0 && (
            <Typography variant="caption" color="text.disabled">
              Nothing yet.
            </Typography>
          )}
          {outgoing.map((edge) => (
            <Chip
              key={edge.id}
              label={edge.implies_tag}
              size="small"
              onDelete={() => handleRemove(edge)}
              disabled={saving}
            />
          ))}
        </Box>

        <Autocomplete
          freeSolo
          options={options}
          value={null}
          onChange={(_, v) => v && handleAdd(v)}
          inputValue={inputValue}
          onInputChange={(_, v) => setInputValue(v)}
          getOptionLabel={(option) => String(option)}
          filterOptions={(x) => x}
          loading={searchFetching}
          loadingText="Searching…"
          noOptionsText={
            debouncedSearch ? `No existing tag matches - press Enter to add "${debouncedSearch}" as a new one` : 'Type to add an implied tag'
          }
          disabled={saving}
          renderInput={(params) => (
            <TextField {...params} label="Add an implied tag" size="small" placeholder="Search tags, or type a new one…" />
          )}
        />

        {incoming.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
              Implied by:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {incoming.map((edge) => (
                <Chip key={edge.id} label={edge.tag} size="small" variant="outlined" />
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Edit these from the other tag's own dialog.
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Alias Dialog ─────────────────────────────────────────────────────────────
//
// Manages this tag's own alias status: whether it's itself an alias of
// some other, root tag, and which other
// tags (if any) are aliased to it.

interface AliasDialogProps {
  open: boolean;
  tag: TypeReadOnlyDatabaseItem | null;
  aliases: TypeTagAliasRecord[];
  onClose: () => void;
  onSaved: () => void;
}

function AliasDialog({ open, tag, aliases, onClose, onSaved }: AliasDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const debouncedSearch = useDebounce(inputValue, 400);
  // A second, separate field: a brand-new alias string that should resolve
  // TO this tag - "orca" pointing at "killer whale", say, where "orca" is
  // never expected to be tagged on a pattern directly, only searched for.
  // Deliberately a plain string, not a search-backed Autocomplete like the
  // one above - the normal case here is typing something that does NOT
  // already exist, so suggesting existing tags would be the wrong prompt.
  const [newAliasInput, setNewAliasInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { log } = useAdminLogger();

  // Reprimes on open, matching SetParentDialog/TagMetadataDialog - see the
  // identical note on ImpliedTagsDialog above.
  useEffect(() => {
    if (open) {
      setInputValue('');
      setNewAliasInput('');
      setError(null);
    }
  }, [open, tag]);

  const { data: searchData, isFetching: searchFetching } = useQueryAdminTagStatsPaginated({
    page: 0,
    pageSize: 50,
    search: debouncedSearch,
    sortField: 'count',
    sortDir: 'desc',
  });

  // Is this tag itself registered as an alias of some other tag?
  const ownAlias = useMemo(() => (tag ? aliases.find((a) => a.alias === tag.tag) : undefined), [tag, aliases]);
  // What other tags alias to this one as their root?
  const pointingHere = useMemo(() => (tag ? aliases.filter((a) => a.target_tag === tag.tag) : []), [tag, aliases]);

  // Excludes self, and anything already registered as an alias of something
  // else - resolveTagAlias only resolves one hop, so a target must always
  // be a root, non-aliased tag (this dialog's own doc comment states that
  // invariant; nothing was previously enforcing it). This also rules out a
  // 2-node cycle (X aliased to Y, then Y aliased back to X): X would only
  // be excluded here in the first place because X already has its own
  // alias row (found via code review).
  const options = useMemo(() => {
    if (!tag) return [];
    const alreadyAliased = new Set(aliases.map((a) => a.alias));
    return (searchData?.items ?? [])
      .map((item) => String(item.tag))
      .filter((name) => name !== tag.tag && !alreadyAliased.has(name));
  }, [tag, searchData, aliases]);

  const handleSetAlias = async (target: string) => {
    if (!tag) return;
    setSaving(true);
    setError(null);
    try {
      // target_tag_ref is written alongside target_tag. alias itself never
      // gets a ref field, deliberately.
      const targetResolved = await resolveOrCreateTagV2Row(target);
      if (ownAlias) {
        await pocketbase
          .collection('tag_aliases')
          .update(ownAlias.id, { target_tag: target, target_tag_ref: targetResolved.row.id });
      } else {
        await pocketbase
          .collection('tag_aliases')
          .create({ alias: tag.tag, target_tag: target, target_tag_ref: targetResolved.row.id });
      }
      log({
        action: 'Tag Alias Set',
        entity_type: 'Tag',
        entity_id: tag.tag,
        entity_name: tag.tag,
        changes: { alias_of: { from: ownAlias?.target_tag ?? null, to: target } },
        metadata: {},
      });
      setInputValue('');
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleClearAlias = async () => {
    if (!ownAlias || !tag) return;
    setSaving(true);
    setError(null);
    try {
      await pocketbase.collection('tag_aliases').delete(ownAlias.id);
      log({
        action: 'Tag Alias Cleared',
        entity_type: 'Tag',
        entity_id: tag.tag,
        entity_name: tag.tag,
        changes: { alias_of: { from: ownAlias.target_tag, to: null } },
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

  // Adds a brand-new alias pointing at this tag - see the newAliasInput
  // comment above for why this is a separate field from the search box.
  // "orca" never needs its own tags_v2 row or its own place in the main
  // admin grid; it exists purely as a redirect, the same way a tag_aliases
  // row already works for a spelling variant.
  const handleAddIncomingAlias = async () => {
    if (!tag) return;
    const alias = normalizeTagName(newAliasInput);
    if (!alias) return;
    if (alias === tag.tag) {
      setError("A tag can't be an alias of itself.");
      return;
    }
    const asAlias = aliases.find((a) => a.alias === alias);
    if (asAlias) {
      setError(`"${alias}" is already an alias of "${asAlias.target_tag}". Remove that first if you want to repoint it here.`);
      return;
    }
    if (aliases.some((a) => a.target_tag === alias)) {
      // Alias resolution is single-hop by design (see resolveTagAlias in
      // src/functions/database/tags.ts) - chaining through "alias" here
      // would silently break resolution for whatever already points at it.
      setError(`"${alias}" already has aliases of its own pointing at it - aliasing it to "${tag.tag}" would chain two hops, which this system doesn't resolve.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // An alias must never shadow a tag with its own real identity - if
      // "orca" already exists as its own tags_v2 row, aliasing it away
      // here would silently hide that, and any pattern already tagged
      // "orca" directly would drift out of sync with search (which would
      // now resolve "orca" to this tag instead). Merging is the right tool
      // for folding one real, in-use tag into another - point the admin
      // there instead of guessing.
      const existingTagRow = await findTagV2Record(alias);
      if (existingTagRow) {
        setError(`"${alias}" already exists as its own tag. Use Rename/Merge instead if you want to fold it into "${tag.tag}".`);
        setSaving(false);
        return;
      }

      // target_tag_ref is this dialog's own tag (the alias's target) -
      // alias itself stays ref-less, deliberately (an alias like "orca" is
      // allowed to have no tags_v2 row of its own). Uses tag.id directly,
      // not a re-resolve-by-name - same reasoning as
      // ImpliedTagsDialog.handleAdd's own sourceId: `tag` comes from the
      // admin grid (tag_usage-backed), whose id is already the real,
      // specific tags_v2 id for this row - re-resolving by name could land
      // on a different row once two rows can share a name.
      const targetId = tag.id;

      await pocketbase.collection('tag_aliases').create({ alias, target_tag: tag.tag, target_tag_ref: targetId });
      log({
        action: 'Tag Alias Added',
        entity_type: 'Tag',
        entity_id: tag.tag,
        entity_name: tag.tag,
        changes: { new_alias: { from: null, to: alias } },
        metadata: {},
      });
      setNewAliasInput('');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // Removes one alias that points at this tag. This is the only place an
  // alias like "orca" can be removed from at all, since it may have no
  // tags_v2 row and so no row of its own in the main admin grid to open a
  // dialog from.
  const handleRemoveIncomingAlias = async (edge: TypeTagAliasRecord) => {
    if (!tag) return;
    setSaving(true);
    setError(null);
    try {
      await pocketbase.collection('tag_aliases').delete(edge.id);
      log({
        action: 'Tag Alias Removed',
        entity_type: 'Tag',
        entity_id: tag.tag,
        entity_name: tag.tag,
        changes: { removed_alias: { from: edge.alias, to: null } },
        metadata: {},
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SwapHorizIcon color="primary" fontSize="small" />
        Alias for "{tag?.tag}"
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {ownAlias && (
          <Alert severity="info" sx={{ mb: 2 }}>
            "{tag?.tag}" is currently an alias of <strong>{ownAlias.target_tag}</strong>. Setting a new root below
            replaces this; anyone who types "{tag?.tag}" resolves to whatever root you set here.
          </Alert>
        )}

        <Box sx={{ py: 2 }}>
          <Autocomplete
            options={options}
            value={null}
            onChange={(_, v) => v && handleSetAlias(v)}
            inputValue={inputValue}
            onInputChange={(_, v) => setInputValue(v)}
            getOptionLabel={(option) => String(option)}
            filterOptions={(x) => x}
            loading={searchFetching}
            loadingText="Searching…"
            noOptionsText={debouncedSearch ? 'No tags found' : 'Type to search for a root tag'}
            disabled={saving}
            renderInput={(params) => (
              <TextField
                {...params}
                label={ownAlias ? 'Change the root tag' : 'Make this tag an alias of…'}
                size="small"
                placeholder="Search tags…"
              />
            )}
          />
        </Box>

        <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
          Aliases that resolve to "{tag?.tag}":
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5, minHeight: 32 }}>
          {pointingHere.length === 0 && (
            <Typography variant="caption" color="text.disabled">
              None yet.
            </Typography>
          )}
          {pointingHere.map((a) => (
            <Chip
              key={a.id}
              label={a.alias}
              size="small"
              variant="outlined"
              onDelete={() => handleRemoveIncomingAlias(a)}
              disabled={saving}
            />
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField
            label="Add an alias that resolves here"
            placeholder='e.g. "orca" - does not need to exist as its own tag'
            size="small"
            fullWidth
            value={newAliasInput}
            disabled={saving}
            onChange={(e) => setNewAliasInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddIncomingAlias();
              }
            }}
          />
          <Button onClick={handleAddIncomingAlias} disabled={saving || !newAliasInput.trim()} sx={{ flexShrink: 0 }}>
            Add
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        {ownAlias && (
          <Button color="warning" onClick={handleClearAlias} disabled={saving}>
            Clear Alias
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
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

  // Compared via normalizeTagName, not raw .trim(), on both counts: tagStats
  // entries are already canonically-cased (the tags view lowercases them),
  // so a case-different typed value would otherwise never match an existing
  // tag; and a "rename" that's only a casing/whitespace difference from the
  // original must be blocked here, not just detected downstream - it's the
  // exact input that corrupts patterns/tags_v2 consistency and wipes the
  // implied-tags graph if allowed through (found via code review).
  const fromExists = tagStats.some((t) => t.tag === normalizeTagName(fromTag));
  const toExists = tagStats.some((t) => t.tag === normalizeTagName(toTag));
  // Named separately from canSubmit below so the same-tag case can get its
  // own helper text instead of silently disabling the button with no
  // explanation - the gap this UI fix closes. syncSatelliteTablesForOp also
  // guards this same case server-side, as defense in depth, not because
  // this UI lets it through today.
  const sameTag = fromTag.trim() !== '' && toTag.trim() !== '' && normalizeTagName(fromTag) === normalizeTagName(toTag);
  const canSubmit = fromTag.trim() && toTag.trim() && !sameTag && fromExists;

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
          error={sameTag}
          helperText={
            sameTag
              ? `Same as ${mode === 'rename' ? 'the current name' : 'the tag to absorb'}`
              : mode === 'merge' && toTag.trim() && !toExists
                ? 'This tag will be created'
                : ' '
          }
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
  const [tagViewMode, setTagViewMode] = useState<'list' | 'tree' | 'graph'>('list');

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
  // tags_v2 holds the canonical Type/Definition/disambiguation-note
  // metadata. Full-list fetches, same convention as `hierarchy` above - a
  // per-row Map lookup client-side rather than a query per DataGrid row.
  const [metadataRow, setMetadataRow] = useState<TypeReadOnlyDatabaseItem | null>(null);
  const { data: tagsV2List = [], refetch: refetchTagsV2 } = useQueryGetAllTagsV2();
  const { data: tagTypesList = [] } = useQueryGetAllTagTypes();
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
    refetchTagsV2();
    queryClient.invalidateQueries({ queryKey: TAGS_V2_QUERY_KEY });
  }, [refetchTagsV2, queryClient]);

  // ── Implied Tags dialog ────────────────────────────────────────────────────
  const [impliedTagsRow, setImpliedTagsRow] = useState<TypeReadOnlyDatabaseItem | null>(null);
  const { data: impliedTagsList = [], refetch: refetchImpliedTags } = useQueryGetImpliedTags();

  const handleImpliedTagsSaved = useCallback(() => {
    refetchImpliedTags();
    queryClient.invalidateQueries({ queryKey: IMPLIED_TAGS_QUERY_KEY });
  }, [refetchImpliedTags, queryClient]);

  // ── Alias dialog ────────────────────────────────────────────────────────────
  const [aliasRow, setAliasRow] = useState<TypeReadOnlyDatabaseItem | null>(null);
  const { data: tagAliasesList = [], refetch: refetchTagAliases } = useQueryGetAllTagAliases();

  const handleAliasSaved = useCallback(() => {
    refetchTagAliases();
    queryClient.invalidateQueries({ queryKey: TAG_ALIASES_QUERY_KEY });
  }, [refetchTagAliases, queryClient]);

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
        // actually carries a given tag). A rename
        // touches no patterns at all - a renamed tags_v2 row keeps its own
        // id, so every pattern already pointing at it is still correct.
        // The progress callback drives the same live "Processing N of M"
        // bar the old loop did.
        const { patternsAffected } = await syncSatelliteTablesForOp(type, tag, newTag, (completed, total) =>
          setProgress((p) => ({ ...p, completed, total })),
        );
        refetchHierarchy();
        refetchTagsV2();
        refetchImpliedTags();
        refetchTagAliases();
        queryClient.invalidateQueries({ queryKey: TAG_HIERARCHY_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: TAGS_V2_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: IMPLIED_TAGS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: TAG_ALIASES_QUERY_KEY });

        // A rename's own patternsAffected stays empty - on purpose, no
        // pattern was touched. For the admin log's own record (an audit
        // trail of how many patterns a tag reached, not a claim about what
        // this specific operation touched), fall back to this tag's
        // last-known usage count from the already-loaded tagStats grid data
        // instead of fetching patterns again just to count them.
        const loggedPatternCount =
          type === 'rename' ? (tagStats.find((s) => s.tag === tag)?.count ?? 0) : patternsAffected.length;

        setProgress((p) => ({
          ...p,
          done: true,
          total: patternsAffected.length,
          completed: patternsAffected.length,
          successMessage:
            type === 'rename' ? `"${tag}" renamed to "${newTag}" - no pattern records needed updating.` : undefined,
        }));

        const actionLabel = type === 'delete' ? 'Tag Deleted' : type === 'rename' ? 'Tag Renamed' : 'Tag Merged';
        log({
          action: actionLabel,
          entity_type: 'Tag',
          entity_id: tag,
          entity_name: tag,
          changes: newTag ? { tag: { from: tag, to: newTag } } : {},
          metadata: {
            number_of_affected_patterns: loggedPatternCount,
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
    [
      queryClient,
      refetchHierarchy,
      refetchTagsV2,
      refetchImpliedTags,
      refetchTagAliases,
      log,
      setIsFetchingPatterns,
      tagStats,
    ],
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

  const startDeleteMany = useCallback(
    async (tags: string[]) => {
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
          const typeInfo = tagsV2ById.get(params.row.id)?.expand?.type;
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
        width: 230,
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
            <Tooltip title="Manage implied tags">
              <IconButton size="small" onClick={() => setImpliedTagsRow(params.row)}>
                <DeviceHubIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Manage alias">
              <IconButton size="small" onClick={() => setAliasRow(params.row)}>
                <SwapHorizIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Set parent tag (legacy hierarchy)">
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
    [hierarchy, startOp, tagsV2ById],
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
            onNodeClick={(tag) => setImpliedTagsRow(tag)}
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
