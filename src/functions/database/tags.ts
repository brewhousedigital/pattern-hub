import { useQuery, queryOptions } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

/**
 * Escapes a value for safe interpolation into a double-quoted PocketBase
 * filter string - e.g. `tag = "${escapeTagFilterValue(tag)}"`. Every filter
 * built from a free-typed tag/slug value in this file and in
 * space-command/tags.tsx should go through this first; an unescaped tag
 * containing a `"` (a plausible size tag like `6" hoop` on this site)
 * otherwise breaks the filter's quoting - either erroring the request or
 * letting the tag's own text reshape the query. Matches the escaping
 * convention already used elsewhere in this codebase (authors.ts, sets.ts,
 * admin-logs.ts) and by useQueryGetTagUsageCount below.
 */
export function escapeTagFilterValue(value: string): string {
  return value.replace(/"/g, '\\"');
}

// ─── Tags view (read-only) ────────────────────────────────────────────────────
//
// The `tags` collection is a PocketBase View Collection generated from a SQL
// SELECT that aggregates pattern tag counts.  It is read-only and its IDs are
// random per-query - do NOT use its IDs as foreign keys.

export const useQueryGetAllTags = () => {
  return useQuery({
    queryKey: ['GetAllTags'],
    queryFn: async (): Promise<TypeReadOnlyDatabaseItem[]> => {
      const items = await pocketbase.collection('tags').getFullList<TypeReadOnlyDatabaseItem>({
        sort: '-count',
      });
      // Defense-in-depth: ensure numeric-looking tags (e.g. "2007") are strings.
      return items.map((item) => ({ ...item, tag: String(item.tag) }));
    },
  });
};

export const useQuerySearchTags = (searchTerm: string, enabled = true) => {
  return useQuery({
    queryKey: ['SearchTags', searchTerm],
    queryFn: async (): Promise<TypeReadOnlyDatabaseItem[]> => {
      const safe = searchTerm.trim().replace(/"/g, '\\"');
      const result = await pocketbase.collection('tags').getList<TypeReadOnlyDatabaseItem>(1, 100, {
        sort: '-count',
        ...(safe ? { filter: `tag ~ "${safe}"` } : {}),
      });
      // Defense-in-depth: ensure numeric-looking tags (e.g. "2007") are strings.
      return result.items.map((item) => ({ ...item, tag: String(item.tag) }));
    },
    enabled,
    placeholderData: (prev) => prev,
  });
};

// ─── Tag hierarchy (regular collection, fully writable) ──────────────────────
//
// A separate `tag_hierarchy` regular collection stores parent/child
// relationships keyed on lowercase tag name strings - avoiding any dependency
// on the view's unstable per-query IDs.
//
//   tag_hierarchy: { id, tag: string, parent_tag: string }
//
// One record per child tag.  Tag names are the canonical, stable key.

export interface TypeTagHierarchyRecord {
  id: string;
  /** The child tag name (lowercase). */
  tag: string;
  /** The parent tag name (lowercase). */
  parent_tag: string;
}

export const TAG_HIERARCHY_QUERY_KEY = ['GetTagHierarchy'] as const;

export const useQueryGetTagHierarchy = () => {
  return useQuery({
    queryKey: TAG_HIERARCHY_QUERY_KEY,
    queryFn: async (): Promise<TypeTagHierarchyRecord[]> => {
      return await pocketbase.collection('tag_hierarchy').getFullList({ sort: 'tag' });
    },
  });
};

/**
 * Set (or update) the parent for a given child tag.
 * Uses an upsert pattern: updates the existing record if one exists, otherwise creates.
 */
export async function setTagParent(childTag: string, parentTag: string): Promise<void> {
  const safe = childTag.toLowerCase().trim();
  const existing = await pocketbase
    .collection('tag_hierarchy')
    .getFirstListItem<TypeTagHierarchyRecord>(`tag = "${safe}"`)
    .catch(() => null);

  if (existing) {
    await pocketbase.collection('tag_hierarchy').update(existing.id, { parent_tag: parentTag.toLowerCase().trim() });
  } else {
    await pocketbase.collection('tag_hierarchy').create({ tag: safe, parent_tag: parentTag.toLowerCase().trim() });
  }
}

/**
 * Remove the parent relationship for a given child tag (makes it a root tag).
 */
export async function clearTagParent(childTag: string): Promise<void> {
  const safe = childTag.toLowerCase().trim();
  const existing = await pocketbase
    .collection('tag_hierarchy')
    .getFirstListItem<TypeTagHierarchyRecord>(`tag = "${safe}"`)
    .catch(() => null);

  if (existing) {
    await pocketbase.collection('tag_hierarchy').delete(existing.id);
  }
}

// ─── Ancestry utilities ───────────────────────────────────────────────────────

/**
 * Walks up the parent chain from `tagName` and returns all ancestor tag *names*
 * in order from immediate parent to root.
 *
 * @param tagName   The tag whose ancestors you want (case-insensitive).
 * @param hierarchy Full list from `useQueryGetTagHierarchy`.
 * @returns         e.g. `['lizard', 'creature']`
 *
 * Guards against circular references - stops after 20 hops.
 */
export function getAncestors(tagName: string, hierarchy: TypeTagHierarchyRecord[]): string[] {
  const ancestors: string[] = [];
  let current = tagName.toLowerCase();
  const visited = new Set<string>();

  for (let hop = 0; hop < 20; hop++) {
    const record = hierarchy.find((h) => h.tag === current);
    if (!record) break;
    if (visited.has(record.parent_tag)) break; // cycle guard
    visited.add(record.parent_tag);
    ancestors.push(record.parent_tag);
    current = record.parent_tag;
  }

  return ancestors;
}

/**
 * Returns every descendant tag name (children, grandchildren, …) of `tagName`.
 * Used to exclude descendants from the "Set Parent" autocomplete (circular-ref guard).
 */
export function getDescendants(tagName: string, hierarchy: TypeTagHierarchyRecord[]): string[] {
  const descendants: string[] = [];
  const queue = [tagName.toLowerCase()];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const parent = queue.shift()!;
    if (visited.has(parent)) continue;
    visited.add(parent);

    for (const h of hierarchy) {
      if (h.parent_tag === parent) {
        descendants.push(h.tag);
        queue.push(h.tag);
      }
    }
  }

  return descendants;
}

// ─── Pattern tag state (hierarchy + pattern-key provenance) ──────────────────
//
// Shared reducer used by both PatternTagsField (admin) and UserUploadForm
// (public submission) so hierarchy-ancestor expansion and pattern-key
// auto-add/auto-remove behave identically on both tag-editing surfaces
// instead of drifting apart as two separately-maintained copies.
//
// A tag can be present in the flat `tags` list for two different auto-added
// reasons at once (e.g. it's both an ancestor of another tag AND carried by
// an assigned pattern key) - it's only eligible for removal once neither
// reason still applies. A tag with neither marker is "primary": the user
// typed it directly, and it's never auto-removed.

export interface TypePatternTagState {
  tags: string[];
  /** Tags present only because they're an ancestor of some other tag currently in `tags`. */
  hierarchyInherited: Set<string>;
  /** Tags present only because a currently-assigned pattern key carries them. */
  keyInherited: Set<string>;
}

// Adds `tag`'s full ancestor chain to `tags`/`hierarchyInherited` if missing.
function addAncestors(
  tag: string,
  tags: string[],
  hierarchyInherited: Set<string>,
  hierarchy: TypeTagHierarchyRecord[],
) {
  for (const ancestor of getAncestors(tag, hierarchy)) {
    if (!tags.includes(ancestor)) {
      tags.push(ancestor);
      hierarchyInherited.add(ancestor);
    }
  }
}

// Walks `removedTag`'s ancestor chain and drops any ancestor no longer
// needed by a remaining tag. Purely hierarchy-inherited tags don't count as
// their own justification - they're byproducts, not an independent reason
// to keep an ancestor around - but a tag that's key-inherited (or fully
// primary) does count, same as before this file tracked key provenance too.
function pruneOrphanedAncestors(
  removedTag: string,
  tags: string[],
  hierarchyInherited: Set<string>,
  keyInherited: Set<string>,
  hierarchy: TypeTagHierarchyRecord[],
) {
  for (const ancestor of getAncestors(removedTag, hierarchy)) {
    const stillNeeded = tags
      .filter((t) => t !== removedTag && !hierarchyInherited.has(t))
      .some((driver) => getAncestors(driver, hierarchy).includes(ancestor));
    if (!stillNeeded) {
      const idx = tags.indexOf(ancestor);
      if (idx !== -1) tags.splice(idx, 1);
      hierarchyInherited.delete(ancestor);
      keyInherited.delete(ancestor);
    }
  }
}

/**
 * Derives the initial `hierarchyInherited` set for a tag list loaded from
 * storage (e.g. on mount): a tag counts as inherited if it's also the
 * ancestor of some other tag already present. Pattern-key provenance is
 * never bootstrapped this way (see `TypePatternTagState.keyInherited`)
 * since it can't be honestly recovered from the flat tag list alone - a tag
 * might just coincidentally match a key's tags without ever having come
 * from it.
 */
export function deriveHierarchyInherited(tags: string[], hierarchy: TypeTagHierarchyRecord[]): Set<string> {
  const inherited = new Set<string>();
  for (const tag of tags) {
    for (const ancestor of getAncestors(tag, hierarchy)) {
      if (tags.includes(ancestor)) inherited.add(ancestor);
    }
  }
  return inherited;
}

/**
 * Recomputes tag state after the user's own explicit tag selection changes
 * (typing a new tag, or removing a chip via the tags Autocomplete). Newly
 * added tags pull in their full hierarchy-ancestor chain; removing a tag
 * that was the sole reason an ancestor was present prunes that ancestor
 * too. A tag touched here is always promoted to (or kept as) fully primary,
 * overriding any inherited markers it carried - direct user action wins
 * over an automatic reason.
 */
export function applyManualTagChange(
  state: TypePatternTagState,
  newTags: string[],
  hierarchy: TypeTagHierarchyRecord[],
): TypePatternTagState {
  const added = newTags.filter((t) => !state.tags.includes(t));
  const removed = state.tags.filter((t) => !newTags.includes(t));

  const tags = [...newTags];
  const hierarchyInherited = new Set(state.hierarchyInherited);
  const keyInherited = new Set(state.keyInherited);

  for (const tag of added) {
    hierarchyInherited.delete(tag);
    keyInherited.delete(tag);
    addAncestors(tag, tags, hierarchyInherited, hierarchy);
  }

  for (const tag of removed) {
    hierarchyInherited.delete(tag);
    keyInherited.delete(tag);
    pruneOrphanedAncestors(tag, tags, hierarchyInherited, keyInherited, hierarchy);
  }

  return { tags, hierarchyInherited, keyInherited };
}

/**
 * Reconciles tag state against the current set of tags carried by assigned
 * pattern keys (see `useResolveKeyTags` in functions/database/patterns.ts) -
 * call whenever that union changes (a key was added, removed, or
 * quick-applied via a collection). Tags no longer carried by any assigned
 * key are dropped, unless the user separately typed them (never marked
 * key-inherited to begin with) or a hierarchy-ancestor chain still needs
 * them. Tags that already exist for another reason are left untouched and
 * NOT retroactively marked key-inherited, so this can never start
 * auto-deleting a tag that predates this reconciliation running.
 */
export function applyKeyTagChange(
  state: TypePatternTagState,
  currentKeyTags: string[],
  hierarchy: TypeTagHierarchyRecord[],
): TypePatternTagState {
  const tags = [...state.tags];
  const hierarchyInherited = new Set(state.hierarchyInherited);
  const keyInherited = new Set(state.keyInherited);

  const normalize = (t: string) => t.trim().toLowerCase();
  const currentKeyTagSet = new Set(currentKeyTags.map(normalize));

  // Newly justified by an assigned key - add + expand hierarchy.
  for (const tag of currentKeyTags) {
    if (tags.some((t) => normalize(t) === normalize(tag))) continue;
    tags.push(tag);
    keyInherited.add(tag);
    addAncestors(tag, tags, hierarchyInherited, hierarchy);
  }

  // No longer justified by any assigned key - drop the marker, and remove
  // the tag outright if nothing else (hierarchy) still needs it.
  for (const tag of [...keyInherited]) {
    if (currentKeyTagSet.has(normalize(tag))) continue;
    keyInherited.delete(tag);
    if (hierarchyInherited.has(tag)) continue;
    const idx = tags.indexOf(tag);
    if (idx !== -1) tags.splice(idx, 1);
    pruneOrphanedAncestors(tag, tags, hierarchyInherited, keyInherited, hierarchy);
  }

  return { tags, hierarchyInherited, keyInherited };
}

// ─── Pattern tag helpers ──────────────────────────────────────────────────────

export interface TypePatternRecord {
  id: string;
  tags: string[];
  name: string;
  [key: string]: unknown;
}

export interface TypeTagStat {
  tag: string;
  count: number;
}

export const ADMIN_TAG_STATS_QUERY_KEY = ['AdminTagStats'] as const;

// Reads the pre-aggregated `tags` view (one row per unique tag + its pattern
// count) instead of walking every pattern page-by-page and counting in JS -
// that used to cost 5+ full-collection requests on every load. Same class of
// bug as the one fixed in AdminEditPatternModal.tsx (see its
// refetchTagManagementStats comment), just triggered by a direct subscriber
// (the tags admin page) instead of a per-row modal.
export const useQueryAdminTagStats = () => {
  return useQuery({
    queryKey: ADMIN_TAG_STATS_QUERY_KEY,
    queryFn: async (): Promise<TypeTagStat[]> => {
      // requestKey: null disables PocketBase's auto-cancellation for this call.
      // By default it derives a request key from just the method + collection
      // path (ignoring filter/sort/page), so this getFullList() would share a
      // key with useQueryAdminTagStatsPaginated's getList() on the same 'tags'
      // collection - whichever fires second silently cancels the other when
      // both mount together on the tags admin page.
      const items = await pocketbase.collection('tags').getFullList<TypeReadOnlyDatabaseItem>({
        sort: '-count',
        requestKey: null,
      });
      return items.map((item) => ({ tag: String(item.tag), count: item.count }));
    },
  });
};

// ─── Paginated tag stats ──────────────────────────────────────────────────────

export const ADMIN_TAG_STATS_PAGINATED_QUERY_KEY = ['AdminTagStatsPaginated'] as const;

export interface TypeAdminTagStatsPaginatedParams {
  /** 0-indexed page (MUI DataGrid convention; +1 before sending to PocketBase). */
  page: number;
  pageSize: number;
  /** Free-text filter: tag ~ "value" - sanitised before sending. */
  search: string;
  sortField: 'tag' | 'count';
  sortDir: 'asc' | 'desc';
}

export const useQueryAdminTagStatsPaginated = (params: TypeAdminTagStatsPaginatedParams) => {
  return useQuery({
    queryKey: [...ADMIN_TAG_STATS_PAGINATED_QUERY_KEY, params],
    queryFn: async (): Promise<{ items: TypeReadOnlyDatabaseItem[]; totalItems: number }> => {
      const safeSearch = params.search.trim().replace(/"/g, '\\"');
      const filter = safeSearch ? `tag ~ "${safeSearch}"` : '';
      const sort = `${params.sortDir === 'desc' ? '-' : ''}${params.sortField}`;

      // requestKey: null - see useQueryAdminTagStats above. This hook has
      // multiple concurrent consumers on the tags admin page alone (the main
      // grid and SetParentDialog's search both query 'tags' with different
      // params/react-query keys), so PocketBase's default same-collection
      // auto-cancellation would otherwise cancel one in favor of the other.
      // React Query's own per-key caching already keeps their results isolated.
      const result = await pocketbase
        .collection('tags')
        .getList<TypeReadOnlyDatabaseItem>(params.page + 1, params.pageSize, {
          sort,
          ...(filter ? { filter } : {}),
          requestKey: null,
        });

      // All-digit tag values (e.g. "2007") can deserialize as JS numbers, which
      // breaks downstream string operations (.endsWith, .toLowerCase). Coerce the
      // tag to a string at the boundary so every consumer gets a real string.
      const items = result.items.map((item) => ({ ...item, tag: String(item.tag) }));

      return { items, totalItems: result.totalItems };
    },
    placeholderData: (prev) => prev,
  });
};

// ─── tags_v2 (canonical tag metadata) ──────────────────────────────────────────
//
// See TAG_REDESIGN_PROJECT_NOTES.md, Phase 1. Unlike the `tags` view above,
// tags_v2 is a real base collection - its IDs are stable, and it holds
// per-tag metadata (Type, Definition, disambiguation note) the view has no
// room for.

export interface TypeTagTypeRecord {
  id: string;
  name: string;
  color: string;
  group_label: string;
  collapsible: boolean;
  display_mode: string;
  input_normalize: string;
  sort_order: number;
}

export interface TypeTagV2Record {
  id: string;
  tag: string;
  slug: string;
  previous_slugs: string[];
  type: string;
  definition: string;
  disambiguation_note: string;
  expand?: { type?: TypeTagTypeRecord };
}

// Matches either the current slug, or a past one filed in `previous_slugs`
// by syncSatelliteTablesForOp (space-command/tags.tsx) after a rename - the
// caller compares the returned row's own `slug` against the requested one
// to detect the previous_slugs case and redirect to the canonical URL.
// Quote-wraps the previous_slugs match so it hits a JSON element boundary,
// the same way tag matching does elsewhere (see buildPatternFilters in
// pb_hooks/main.pb.js) - an unquoted match could over-match a slug that's
// merely a substring of another.
export const getTagBySlugOptions = (slug: string) => {
  const safe = slug.replace(/'/g, "\\'");
  return queryOptions({
    queryKey: ['TagBySlug', slug],
    queryFn: () =>
      pocketbase
        .collection('tags_v2')
        .getFirstListItem<TypeTagV2Record>(`slug = '${safe}' || previous_slugs ~ '"${safe}"'`, { expand: 'type' }),
    retry: false,
  });
};

export const useQueryGetTagBySlug = (slug: string) =>
  useQuery({
    ...getTagBySlugOptions(slug),
    enabled: !!slug,
  });

// Full-list reads, same convention as useQueryGetTagHierarchy above (a
// per-row Map lookup client-side, not a paginated fetch) - reasonable at
// this site's scale, and needed so the admin tag manager's DataGrid can
// look up a row's Type without a query per row.

export const TAGS_V2_QUERY_KEY = ['GetAllTagsV2'] as const;

export const useQueryGetAllTagsV2 = () =>
  useQuery({
    queryKey: TAGS_V2_QUERY_KEY,
    queryFn: async (): Promise<TypeTagV2Record[]> => {
      return await pocketbase.collection('tags_v2').getFullList<TypeTagV2Record>({ sort: 'tag', expand: 'type' });
    },
  });

export const TAG_TYPES_QUERY_KEY = ['GetAllTagTypes'] as const;

export const useQueryGetAllTagTypes = () =>
  useQuery({
    queryKey: TAG_TYPES_QUERY_KEY,
    queryFn: async (): Promise<TypeTagTypeRecord[]> => {
      return await pocketbase.collection('tag_types').getFullList<TypeTagTypeRecord>({ sort: 'sort_order,name' });
    },
  });

// ─── Implied tags (Phase 2) ─────────────────────────────────────────────────────
//
// See TAG_REDESIGN_PROJECT_NOTES.md, Phase 2. `implied_tags` is the
// multi-parent upgrade of `tag_hierarchy`: any number of rows can share the
// same `tag`, unlike tag_hierarchy's one-parent-per-child limit. This
// section is deliberately NOT wired into applyManualTagChange /
// applyKeyTagChange below - those still read tag_hierarchy, and stay doing
// so through Phase 2. Only Phase 3 repoints them at the functions here;
// until then, this is used only by the new admin graph editor and the
// Definition Page, exactly as the phased rollout intends ("data and admin
// tools only, does not yet change how a pattern is tagged").

export interface TypeImpliedTagRecord {
  id: string;
  tag: string;
  implies_tag: string;
}

export const IMPLIED_TAGS_QUERY_KEY = ['GetAllImpliedTags'] as const;

export const useQueryGetImpliedTags = () =>
  useQuery({
    queryKey: IMPLIED_TAGS_QUERY_KEY,
    queryFn: async (): Promise<TypeImpliedTagRecord[]> => {
      return await pocketbase.collection('implied_tags').getFullList<TypeImpliedTagRecord>({ sort: 'tag' });
    },
  });

// A total-nodes-visited safety cap, not a chain-depth one - this is a
// breadth-first walk across however many "implies" edges a tag has, not a
// single linear parent chain like getAncestors() above, so it doesn't map
// to that function's "20 hops" the same way. The `visited` set already
// makes a cycle (A implies B implies A) terminate correctly on its own;
// this cap only guards against an unreasonably large, densely-connected
// graph making the walk expensive.
const IMPLIED_TAGS_MAX_VISITS = 50;

/**
 * Every tag `tagName` transitively implies, walking as many "implies" edges
 * deep as needed - the vertical-and-horizontal spreading the PM doc
 * describes (Orca implies Toothed Whale implies Cetacean, *and* Orca
 * implies Mammal directly - both directions come out of the same walk).
 */
export function getImpliedTags(tagName: string, impliedTags: TypeImpliedTagRecord[]): string[] {
  const result: string[] = [];
  const visited = new Set<string>([tagName.toLowerCase()]);
  const queue = [tagName.toLowerCase()];
  let visits = 0;

  while (queue.length > 0 && visits < IMPLIED_TAGS_MAX_VISITS) {
    const current = queue.shift()!;
    visits++;
    for (const edge of impliedTags) {
      if (edge.tag !== current || visited.has(edge.implies_tag)) continue;
      visited.add(edge.implies_tag);
      result.push(edge.implies_tag);
      queue.push(edge.implies_tag);
    }
  }

  return result;
}

/**
 * The reverse of getImpliedTags(): every tag that transitively implies
 * `tagName`. Used for the Definition Page's "implied by" list, and for a
 * circular-reference guard when picking a new "implies" target in the admin
 * graph editor (mirrors getDescendants()'s role for the old hierarchy's Set
 * Parent dialog).
 */
export function getTagsImplying(tagName: string, impliedTags: TypeImpliedTagRecord[]): string[] {
  const result: string[] = [];
  const visited = new Set<string>([tagName.toLowerCase()]);
  const queue = [tagName.toLowerCase()];
  let visits = 0;

  while (queue.length > 0 && visits < IMPLIED_TAGS_MAX_VISITS) {
    const current = queue.shift()!;
    visits++;
    for (const edge of impliedTags) {
      if (edge.implies_tag !== current || visited.has(edge.tag)) continue;
      visited.add(edge.tag);
      result.push(edge.tag);
      queue.push(edge.tag);
    }
  }

  return result;
}

// ─── Tag aliases (Phase 2) ──────────────────────────────────────────────────────
//
// tag_aliases already existed in the schema before this project - it was
// simply never wired up anywhere. Many-to-one by convention (many aliases
// can point to one root; nothing here stops one alias row pointing at two
// different targets except the unique index on `alias` recommended in
// TAG_REDESIGN_PROJECT_NOTES.md - add it if it isn't there yet).

export interface TypeTagAliasRecord {
  id: string;
  alias: string;
  target_tag: string;
}

export const TAG_ALIASES_QUERY_KEY = ['GetAllTagAliases'] as const;

export const useQueryGetAllTagAliases = () =>
  useQuery({
    queryKey: TAG_ALIASES_QUERY_KEY,
    queryFn: async (): Promise<TypeTagAliasRecord[]> => {
      return await pocketbase.collection('tag_aliases').getFullList<TypeTagAliasRecord>({ sort: 'alias' });
    },
  });

/**
 * Resolves a typed or searched tag through the alias table, if it is one.
 * Returns the input unchanged when it isn't a known alias - safe to call on
 * every tag, not just ones you already suspect are aliased. Case-insensitive
 * against the stored `alias` values, matching every other tag comparison in
 * this codebase.
 *
 * Does not chase an alias-of-an-alias chain - the admin create/edit flow
 * (Phase 2 admin panel) is expected to enforce that every alias points
 * directly at a root, non-aliased tag, the same "duplicate add is ignored"
 * simplicity the PM doc describes.
 */
export function resolveTagAlias(tagName: string, aliases: TypeTagAliasRecord[]): string {
  const norm = tagName.toLowerCase();
  const match = aliases.find((a) => a.alias.toLowerCase() === norm);
  return match ? match.target_tag : tagName;
}

// Scoped single-tag reads for the public Definition Page - direct edges
// only (not the full transitive closure `getImpliedTags`/`getTagsImplying`
// compute for the admin graph editor), so a page view doesn't need to fetch
// either whole table. A visitor can click through to a directly-implied
// tag's own page to keep exploring the graph one hop at a time.

export const useQueryGetDirectImpliedTags = (tag: string) =>
  useQuery({
    queryKey: ['DirectImpliedTags', tag],
    queryFn: async (): Promise<TypeImpliedTagRecord[]> =>
      await pocketbase
        .collection('implied_tags')
        .getFullList<TypeImpliedTagRecord>({ filter: `tag = "${escapeTagFilterValue(tag)}"` }),
    enabled: !!tag,
  });

export const useQueryGetTagsImplyingDirect = (tag: string) =>
  useQuery({
    queryKey: ['TagsImplyingDirect', tag],
    queryFn: async (): Promise<TypeImpliedTagRecord[]> =>
      await pocketbase
        .collection('implied_tags')
        .getFullList<TypeImpliedTagRecord>({ filter: `implies_tag = "${escapeTagFilterValue(tag)}"` }),
    enabled: !!tag,
  });

export const useQueryGetAliasesForTag = (tag: string) =>
  useQuery({
    queryKey: ['AliasesForTag', tag],
    queryFn: async (): Promise<TypeTagAliasRecord[]> =>
      await pocketbase
        .collection('tag_aliases')
        .getFullList<TypeTagAliasRecord>({ filter: `target_tag = "${escapeTagFilterValue(tag)}"` }),
    enabled: !!tag,
  });

// Reads the `tag` view's precomputed count for one tag - reused on the
// Definition Page to link out to "N patterns tagged X" without a second,
// heavier query against `patterns` itself.
export const useQueryGetTagUsageCount = (tag: string) =>
  useQuery({
    queryKey: ['TagUsageCount', tag],
    queryFn: async (): Promise<number> => {
      const safe = escapeTagFilterValue(tag);
      const result = await pocketbase.collection('tags').getList<TypeReadOnlyDatabaseItem>(1, 1, {
        filter: `tag = "${safe}"`,
      });
      return result.items[0]?.count ?? 0;
    },
    enabled: !!tag,
  });
