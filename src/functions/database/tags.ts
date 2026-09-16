import { useQuery, queryOptions } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import { slugifyTag } from '@/functions/utilities/slugify-tag';
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

// ─── Tag usage (read-only) ────────────────────────────────────────────────────
//
// `tag_usage` is a PocketBase View Collection generated from a SQL SELECT
// that aggregates tag counts from patterns.tag_refs/tags_v2, scoped to
// published, non-deleted patterns. It replaced the older `tags` view (which
// aggregated the now-frozen patterns.tags column directly) - every reader in
// this file has been migrated off `tags` onto this view, which has no
// readers left anywhere in the app. Unlike `tags`' random-per-query id,
// tag_usage's id is a real, stable tags_v2 id.

export const useQuerySearchTags = (searchTerm: string, enabled = true) => {
  return useQuery({
    queryKey: ['SearchTags', searchTerm],
    queryFn: async (): Promise<TypeReadOnlyDatabaseItem[]> => {
      const safe = searchTerm.trim().replace(/"/g, '\\"');
      const result = await pocketbase.collection('tag_usage').getList<TypeReadOnlyDatabaseItem>(1, 100, {
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

// ─── Pattern tag state (implied tags + pattern-key provenance) ───────────────
//
// Shared reducer used by both PatternTagsField (admin) and UserUploadForm
// (public submission). It keeps implied-tag expansion and pattern-key
// auto-add/auto-remove identical on both tag-editing surfaces. The two
// surfaces do not maintain separate copies of this logic.
//
// A tag can be present in the flat `tags` list for two different auto-added
// reasons at once. For example, a tag can be implied by another tag AND
// carried by an assigned pattern key at the same time. The tag is eligible
// for removal only once neither reason still applies. A tag with neither
// marker is "primary". The user typed it directly. The system never removes
// a primary tag automatically.
//
// This reducer reads the implied_tags graph, not tag_hierarchy. The field
// name `hierarchyInherited`
// stays the same to limit the size of this change - treat it as a label for
// "auto-added through the implied-tags graph", not a reference to the
// tag_hierarchy table. Every incoming tag is also resolved through the
// alias table first, so adding an alias has the same effect as adding the
// tag it points to.

export interface TypePatternTagState {
  tags: string[];
  /** Tags present only because they're an ancestor of some other tag currently in `tags`. */
  hierarchyInherited: Set<string>;
  /** Tags present only because a currently-assigned pattern key carries them. */
  keyInherited: Set<string>;
}

// Adds every tag that `tag` implies to `tags`/`hierarchyInherited`, if missing.
function addAncestors(
  tag: string,
  tags: string[],
  hierarchyInherited: Set<string>,
  impliedTags: TypeImpliedTagRecord[],
) {
  for (const implied of getImpliedTags(tag, impliedTags)) {
    if (!tags.includes(implied)) {
      tags.push(implied);
      hierarchyInherited.add(implied);
    }
  }
}

// Walks every tag that `removedTag` implies and drops any implied tag no
// longer needed by a remaining tag. A purely implied-inherited tag does not
// count as its own justification for keeping another implied tag around -
// it is a byproduct, not an independent reason. A tag that is key-inherited
// (or fully primary) does count, same as before this file tracked key
// provenance too.
function pruneOrphanedAncestors(
  removedTag: string,
  tags: string[],
  hierarchyInherited: Set<string>,
  keyInherited: Set<string>,
  impliedTags: TypeImpliedTagRecord[],
) {
  for (const implied of getImpliedTags(removedTag, impliedTags)) {
    const stillNeeded = tags
      .filter((t) => t !== removedTag && !hierarchyInherited.has(t))
      .some((driver) => getImpliedTags(driver, impliedTags).includes(implied));
    if (!stillNeeded) {
      const idx = tags.indexOf(implied);
      if (idx !== -1) tags.splice(idx, 1);
      hierarchyInherited.delete(implied);
      keyInherited.delete(implied);
    }
  }
}

/**
 * Derives the initial `hierarchyInherited` set for a tag list loaded from
 * storage (e.g. on mount). A tag counts as inherited if it is also implied
 * by some other tag already present. Pattern-key provenance is never
 * bootstrapped this way (see `TypePatternTagState.keyInherited`). The flat
 * tag list alone cannot show it honestly - a tag might coincidentally match
 * a key's tags without ever having come from it.
 */
export function deriveHierarchyInherited(tags: string[], impliedTags: TypeImpliedTagRecord[]): Set<string> {
  const inherited = new Set<string>();
  for (const tag of tags) {
    for (const implied of getImpliedTags(tag, impliedTags)) {
      if (tags.includes(implied)) inherited.add(implied);
    }
  }
  return inherited;
}

/**
 * Recomputes tag state after the user's own explicit tag selection changes
 * (typing a new tag, or removing a chip via the tags Autocomplete). Every
 * incoming tag is first resolved through the alias table, so typing an
 * alias has the same effect as typing the tag it points to - including
 * becoming a no-op when the resolved tag is already present. Newly added
 * tags pull in every tag they imply; removing a tag that was the sole
 * reason an implied tag was present prunes that implied tag too. A tag
 * touched here is always promoted to (or kept as) fully primary, overriding
 * any inherited markers it carried - direct user action wins over an
 * automatic reason.
 *
 * `aliasPreferredRefs` is a norm(resolved tag) -> tags_v2 id map, populated
 * whenever an incoming entry was
 * itself a known alias with a `target_tag_ref` - the caller (PatternTagsField.tsx)
 * merges this into its own preferredTagRefs the same way it already protects
 * a tag the pattern is already linked to, so resolveOrCreateTagRefs reaches
 * the alias's actual target row at save time instead of re-resolving its
 * name and risking the General default.
 */
export function applyManualTagChange(
  state: TypePatternTagState,
  newTags: string[],
  impliedTags: TypeImpliedTagRecord[],
  aliases: TypeTagAliasRecord[],
): TypePatternTagState & { aliasPreferredRefs: Map<string, string> } {
  const aliasPreferredRefs = new Map<string, string>();
  const resolvedTags = [
    ...new Set(
      newTags.map((t) => {
        const resolved = resolveTagAlias(t, aliases);
        const refId = findAliasTargetRef(t, aliases);
        if (refId) aliasPreferredRefs.set(resolved.trim().toLowerCase(), refId);
        return resolved;
      }),
    ),
  ];
  const added = resolvedTags.filter((t) => !state.tags.includes(t));
  const removed = state.tags.filter((t) => !resolvedTags.includes(t));

  const tags = [...resolvedTags];
  const hierarchyInherited = new Set(state.hierarchyInherited);
  const keyInherited = new Set(state.keyInherited);

  for (const tag of added) {
    hierarchyInherited.delete(tag);
    keyInherited.delete(tag);
    addAncestors(tag, tags, hierarchyInherited, impliedTags);
  }

  for (const tag of removed) {
    hierarchyInherited.delete(tag);
    keyInherited.delete(tag);
    pruneOrphanedAncestors(tag, tags, hierarchyInherited, keyInherited, impliedTags);
  }

  return { tags, hierarchyInherited, keyInherited, aliasPreferredRefs };
}

/**
 * Reconciles tag state against the current set of tags carried by assigned
 * pattern keys (see `useResolveKeyTags` in functions/database/patterns.ts) -
 * call whenever that union changes (a key was added, removed, or
 * quick-applied via a collection). Every incoming key tag is first resolved
 * through the alias table, matching applyManualTagChange, so a pattern key
 * catalog entry that names an alias still dedupes correctly against an
 * already-present root tag. Tags no longer carried by any assigned key are
 * dropped, unless the user separately typed them (never marked
 * key-inherited to begin with) or an implied-tag edge still needs them.
 * Tags that already exist for another reason are left untouched and NOT
 * retroactively marked key-inherited, so this can never start auto-deleting
 * a tag that predates this reconciliation running.
 */
export function applyKeyTagChange(
  state: TypePatternTagState,
  currentKeyTags: string[],
  impliedTags: TypeImpliedTagRecord[],
  aliases: TypeTagAliasRecord[],
): TypePatternTagState & { aliasPreferredRefs: Map<string, string> } {
  const tags = [...state.tags];
  const hierarchyInherited = new Set(state.hierarchyInherited);
  const keyInherited = new Set(state.keyInherited);

  // aliasPreferredRefs - see applyManualTagChange's own doc comment for why
  // this exists.
  const aliasPreferredRefs = new Map<string, string>();
  const resolvedKeyTags = [
    ...new Set(
      currentKeyTags.map((t) => {
        const resolved = resolveTagAlias(t, aliases);
        const refId = findAliasTargetRef(t, aliases);
        if (refId) aliasPreferredRefs.set(resolved.trim().toLowerCase(), refId);
        return resolved;
      }),
    ),
  ];

  const normalize = (t: string) => t.trim().toLowerCase();
  const currentKeyTagSet = new Set(resolvedKeyTags.map(normalize));

  // Newly justified by an assigned key - add + expand implied tags.
  for (const tag of resolvedKeyTags) {
    if (tags.some((t) => normalize(t) === normalize(tag))) continue;
    tags.push(tag);
    keyInherited.add(tag);
    addAncestors(tag, tags, hierarchyInherited, impliedTags);
  }

  // No longer justified by any assigned key - drop the marker, and remove
  // the tag outright if nothing else (an implied-tag edge) still needs it.
  for (const tag of [...keyInherited]) {
    if (currentKeyTagSet.has(normalize(tag))) continue;
    keyInherited.delete(tag);
    if (hierarchyInherited.has(tag)) continue;
    const idx = tags.indexOf(tag);
    if (idx !== -1) tags.splice(idx, 1);
    pruneOrphanedAncestors(tag, tags, hierarchyInherited, keyInherited, impliedTags);
  }

  return { tags, hierarchyInherited, keyInherited, aliasPreferredRefs };
}

// ─── Pattern tag helpers ──────────────────────────────────────────────────────

export interface TypePatternRecord {
  id: string;
  tags: string[];
  name: string;
  /**
   * Optional so a fetch that didn't request this field (e.g. one still
   * scoped to `tags` alone) still type-checks.
   */
  tag_refs?: string[];
  [key: string]: unknown;
}

export interface TypeTagStat {
  tag: string;
  count: number;
}

export const ADMIN_TAG_STATS_QUERY_KEY = ['AdminTagStats'] as const;

// Reads the pre-aggregated `tag_usage` view (one row per unique tag + its
// pattern count) instead of walking every pattern page-by-page and counting
// in JS - that used to cost 5+ full-collection requests on every load. Same
// class of bug as the one fixed in AdminEditPatternModal.tsx (see its
// refetchTagManagementStats comment), just triggered by a direct subscriber
// (the tags admin page) instead of a per-row modal.
export const useQueryAdminTagStats = () => {
  return useQuery({
    queryKey: ADMIN_TAG_STATS_QUERY_KEY,
    queryFn: async (): Promise<TypeTagStat[]> => {
      // requestKey: null disables PocketBase's auto-cancellation for this call.
      // By default it derives a request key from just the method + collection
      // path (ignoring filter/sort/page), so this getFullList() would share a
      // key with useQueryAdminTagStatsPaginated's getList() on the same
      // 'tag_usage' collection - whichever fires second silently cancels the
      // other when both mount together on the tags admin page.
      const items = await pocketbase.collection('tag_usage').getFullList<TypeReadOnlyDatabaseItem>({
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
  /**
   * A pre-built PocketBase filter fragment on `tag_usage`'s `type` column
   * (e.g. `type = "<tag_types id>"`), ANDed in alongside `search`. The
   * caller builds this (see space-command/tags.tsx's typeFilterExpr) since
   * it already has the tag_types list and knows the "General" special case
   * (matching a blank type too) - this hook stays a dumb pass-through, the
   * same way it treats `search`. Omit for "all types."
   */
  typeFilter?: string;
}

// Reads the `tag_usage` view instead of `tags`. Same shape (id/tag/count),
// same semantics (published, non-deleted patterns only) - the difference is
// what it's computed from: `tag_usage` walks patterns.tag_refs joined to
// tags_v2, `tags` walks patterns.tags directly. Tag-entry and rename both
// stopped writing patterns.tags, so `tag_usage` is the only one of the two
// that stays accurate going forward. Every other reader in this file has
// since migrated to tag_usage too, so `tags` itself has no readers left and
// is safe to drop from PocketBase. This hook's own id is a real, stable
// tags_v2 id (unlike `tags`', which is random per-query and never safe as a
// foreign key).
//
// `typeFilter` (see TypeAdminTagStatsPaginatedParams) requires tag_usage's
// own view query to SELECT tags_v2.type AS type - it isn't there yet as of
// this comment, so filtering by Type does nothing server-side until that
// view query is updated in PocketBase to:
//   SELECT tags_v2.id AS id, tags_v2.tag AS tag, COUNT(*) AS count, tags_v2.type AS type
//   FROM patterns, json_each(patterns.tag_refs) je
//   JOIN tags_v2 ON tags_v2.id = je.value
//   WHERE patterns.isDeleted = false AND patterns.is_draft = false
//   GROUP BY tags_v2.id
// The Type column itself doesn't need this - it already reads type from
// tagsV2ById (a separate, full tags_v2 fetch) in TagColumns.tsx, independent
// of what this view returns.
export const useQueryAdminTagStatsPaginated = (params: TypeAdminTagStatsPaginatedParams) => {
  return useQuery({
    queryKey: [...ADMIN_TAG_STATS_PAGINATED_QUERY_KEY, params],
    queryFn: async (): Promise<{ items: TypeReadOnlyDatabaseItem[]; totalItems: number }> => {
      const safeSearch = params.search.trim().replace(/"/g, '\\"');
      const filterParts = [];
      if (safeSearch) filterParts.push(`tag ~ "${safeSearch}"`);
      if (params.typeFilter) filterParts.push(params.typeFilter);
      const filter = filterParts.join(' && ');
      const sort = `${params.sortDir === 'desc' ? '-' : ''}${params.sortField}`;

      // requestKey: null - see useQueryAdminTagStats above. This hook has
      // multiple concurrent consumers on the tags admin page alone (the main
      // grid and SetParentDialog's search both query this view with different
      // params/react-query keys), so PocketBase's default same-collection
      // auto-cancellation would otherwise cancel one in favor of the other.
      // React Query's own per-key caching already keeps their results isolated.
      const result = await pocketbase
        .collection('tag_usage')
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
// Unlike the `tags` view above, tags_v2 is a real base collection - its IDs
// are stable, and it holds
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
  /**
   * The registered user this Author-type tag belongs to, if any. Empty for
   * an author with no
   * account, and for every non-Author tag. At most one tag should ever
   * carry a given user's id - enforced in application logic (the admin
   * linking tool, and the account-rename hook in main.pb.js), not a
   * database constraint, matching how tags_v2.type's cardinality is
   * enforced the same way.
   */
  linked_user: string;
  expand?: { type?: TypeTagTypeRecord; linked_user?: { id: string; name: string } };
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
      return await pocketbase
        .collection('tags_v2')
        .getFullList<TypeTagV2Record>({ sort: 'tag', expand: 'type,linked_user' });
    },
  });

/**
 * Searches tags_v2 directly by name. Unlike the `tags`/`tag_usage` views,
 * which only ever list a tag actually carried by a published, non-deleted
 * pattern, this surfaces every tags_v2 row that exists at all - including
 * one just created via ImpliedTagsDialog/AliasDialog, or only present on a
 * draft pattern so far. tags_v2 has no usage-count column of its own to
 * sort by (unlike the views this supplements for entry), so this sorts
 * alphabetically - callers that want a "most used first" default keep
 * using tags/tag_usage for an empty search term, and switch to this once
 * there's something to search for. See PatternTagsField.tsx/
 * UserUploadForm.tsx for that split.
 *
 * Expands `type` so a caller can tell an Author-type row apart from a
 * same-named General one -
 * e.g. tagNeedsArtistSuffix, used by HomepageSearchV3.tsx's tag dropdown to
 * show both a General and an Author "autumn" as distinct, labelled options
 * instead of one collapsed row a name-keyed view could never tell apart.
 */
export const useQuerySearchTagsV2 = (searchTerm: string, enabled = true) => {
  return useQuery({
    queryKey: ['SearchTagsV2', searchTerm],
    queryFn: async (): Promise<TypeTagV2Record[]> => {
      const safe = escapeTagFilterValue(searchTerm.trim());
      const result = await pocketbase.collection('tags_v2').getList<TypeTagV2Record>(1, 50, {
        sort: 'tag',
        expand: 'type',
        ...(safe ? { filter: `tag ~ "${safe}"` } : {}),
      });
      return result.items;
    },
    enabled,
    placeholderData: (prev) => prev,
  });
};

export const TAG_TYPES_QUERY_KEY = ['GetAllTagTypes'] as const;

export const useQueryGetAllTagTypes = () =>
  useQuery({
    queryKey: TAG_TYPES_QUERY_KEY,
    queryFn: async (): Promise<TypeTagTypeRecord[]> => {
      return await pocketbase.collection('tag_types').getFullList<TypeTagTypeRecord>({ sort: 'sort_order,name' });
    },
  });

export const AUTHOR_TAG_IDS_QUERY_KEY = ['AuthorTagIds'] as const;

/**
 * Every tags_v2 id whose Type is "Author" - a small, targeted set (one row
 * per author actually linked to a tag), not the whole table. Used to filter
 * Author-typed tags out of the admin pattern-tag entry dropdown
 * (PatternTagsField.tsx). An author's tag is meant to be entirely derived
 * from patterns.authors/
 * author_manual via the account-name cascade
 * (scripts/backfill-author-tags.mjs, /api/sync-author-tags), never picked
 * directly there - filtering it out removes the "which autumn did you mean"
 * ambiguity at its source instead of disambiguating it after the fact, the
 * way the search-bar dropdowns (which have no equivalent dedicated author
 * picker to defer to) still have to.
 */
export const useQueryAuthorTagIds = () => {
  const { data: tagTypes = [] } = useQueryGetAllTagTypes();
  const authorTypeId = tagTypes.find((t) => t.name === 'Author')?.id;
  return useQuery({
    queryKey: [...AUTHOR_TAG_IDS_QUERY_KEY, authorTypeId],
    queryFn: async (): Promise<Set<string>> => {
      const rows = await pocketbase
        .collection('tags_v2')
        .getFullList<TypeTagV2Record>({ filter: `type = "${authorTypeId}"` });
      return new Set(rows.map((r) => r.id));
    },
    enabled: !!authorTypeId,
  });
};

// ─── tags_v2 slug helpers ───────────────────────────────────────────────────────
//
// Moved here from space-command/tags.tsx so resolveOrCreateTagRefs below can
// reuse them instead of a third copy of this logic. tags.tsx now imports
// these instead of defining its own.

/**
 * Checks both the live `slug` column AND every row's `previous_slugs`
 * history - a candidate can't be handed out if it's already parked in
 * another tag's redirect history, or two different URLs would end up
 * claiming the same slug (getTagBySlugOptions's `slug = X || previous_slugs
 * ~ X` lookup would then match two different rows for the same request).
 */
export async function isSlugTaken(slug: string, excludeId: string): Promise<boolean> {
  const safe = escapeTagFilterValue(slug);
  const match = await pocketbase
    .collection('tags_v2')
    .getFirstListItem(`(slug = "${safe}" || previous_slugs ~ '"${safe}"') && id != "${excludeId}"`)
    .catch(() => null);
  return !!match;
}

/**
 * Disambiguates a slug collision the same way scripts/backfill-tags-v2.mjs
 * and /api/sync-tag-catalog do - append -2, -3, ... until the candidate is
 * free. `excludeId` keeps a record from colliding with its own current slug
 * while it's mid-rename; pass '' when creating a brand-new row.
 */
export async function uniqueSlugFor(baseSlug: string, excludeId: string): Promise<string> {
  let candidate = baseSlug;
  let suffix = 2;
  while (await isSlugTaken(candidate, excludeId)) {
    candidate = `${baseSlug}-${suffix++}`;
  }
  return candidate;
}

// ─── Synchronous tag_refs resolution ─────────────────────────────────────────
//
// patterns.tag_refs is a relation to tags_v2, so - unlike the old free-solo
// tags entry, which could rely on
// /api/sync-tag-catalog to create a missing tags_v2 row later, on a schedule
// - a tag typed here needs its tags_v2 row to exist *before* the pattern
// save request that references it. resolveOrCreateTagRefs does that
// resolution synchronously, reusing the find-or-create-with-a-unique-slug
// shape /api/sync-tag-catalog and scripts/backfill-tags-v2.mjs already use.

/**
 * Finds the tags_v2 row for `tagName`, matching by name alone (any type).
 * Moved here from space-command/tags.tsx so resolveOrCreateTagV2Row below
 * can share it - tags.tsx now imports this instead of defining its own
 * copy; every existing call site there keeps working unchanged.
 */
export async function findTagV2Record(tagName: string): Promise<TypeTagV2Record | null> {
  return await pocketbase
    .collection('tags_v2')
    .getFirstListItem<TypeTagV2Record>(`tag = "${escapeTagFilterValue(tagName)}"`)
    .catch(() => null);
}

/**
 * Resolves the tags_v2 row for `name`, creating a General-type one if no
 * row exists at all. Prefers an existing General-type row when one exists;
 * otherwise falls back to findTagV2Record's type-blind "first match" - this
 * is the fix to a gap this function's own history already predicted:
 *
 * A first version of this (and of the pattern save-path resolver below)
 * scoped every lookup to type = "" (General) only, reasoning that
 * tags_v2.tag is not globally unique and a bare typed string should never
 * accidentally latch onto an unrelated Author-typed row. That reasoning was
 * sound for a name typed fresh into an entry field, but it was applied to
 * every name already sitting in a pattern's existing tags too - including
 * one added by the author-cascade mechanism
 * (scripts/backfill-author-tags.mjs, /api/sync-author-tags), which is
 * *already* correctly resolved to a specific Author-typed row before it
 * ever reaches patterns.tags. Scoping resolution to General-only there
 * created a redundant, disconnected General-type row for every such name
 * instead of reusing the one the cascade already created and linked -
 * caught via a live dry run of scripts/backfill-tag-refs.mjs, which
 * reported ~136 such rows. That led to a second version, purely
 * type-blind, matching how every other tags_v2 consumer in this codebase
 * had always resolved a name, back when tags_v2.tag was still globally
 * unique and type-blind was the only kind of lookup that could exist - but
 * that version's own comment named the exact gap it was accepting: a fresh
 * "autumn" resolving to the artist's row instead of the season's stays
 * safe only until a real rename actually exercises the relaxed uniqueness.
 * That rename happened - renaming the artist's own disambiguated tag back
 * to plain "autumn." Pure type-blind would have meant re-saving any of the
 * three existing seasonal patterns after the rename could
 * non-deterministically resolve "autumn" to the artist's row instead,
 * silently swapping what the pattern is tagged with. Preferring General
 * first closes that gap without reopening the first version's own bug: a
 * name resolves General-first only when a General row already exists; if
 * none does, the type-blind fallback still finds and reuses whatever row
 * does exist, exactly as the second version already did.
 */
export async function resolveOrCreateTagV2Row(name: string): Promise<{ row: TypeTagV2Record; created: boolean }> {
  const generalOnly = await pocketbase
    .collection('tags_v2')
    .getFirstListItem<TypeTagV2Record>(`tag = "${escapeTagFilterValue(name)}" && type = ""`)
    .catch(() => null);
  const existing = generalOnly ?? (await findTagV2Record(name));
  if (existing) return { row: existing, created: false };

  const baseSlug = slugifyTag(name);
  if (!baseSlug) {
    // Every caller (both save-path resolvers and the admin dialogs this
    // function was moved out of) wraps its own call in a try/catch that
    // shows this message directly - AdminEditPatternModal.tsx and
    // review.tsx via enqueueSnackbar(error.message), the dialogs via their
    // own error banner. Throwing here, rather than falling back to a
    // generic slug, surfaces the real problem instead of silently minting
    // a "tag"/"tag-2"/"tag-3" row for whatever punctuation-only string
    // triggered it.
    throw new Error(`"${name}" has no letters or numbers, so it can't be given a URL-safe slug.`);
  }
  const slug = await uniqueSlugFor(baseSlug, '');
  try {
    const created = await pocketbase
      .collection('tags_v2')
      .create<TypeTagV2Record>({ tag: name, slug, previous_slugs: [] });
    return { row: created, created: true };
  } catch (createError) {
    // A concurrent save could have created the same row between the lookup
    // above and this create - the (tag, type) composite unique index
    // rejects the loser instead of allowing a silent duplicate.
    // Re-fetch once rather than dropping the tag from this save's
    // tag_refs.
    const retried = await findTagV2Record(name);
    if (retried) return { row: retried, created: false };
    throw createError;
  }
}

/**
 * Resolves every tag name in `tagNames` to its tags_v2 row id, creating a
 * General-type row for any name with no matching row at all (see
 * resolveOrCreateTagV2Row above). Returns ids in the same relative order as
 * the input, one per distinct name. Pass already-normalized names
 * (normalizeTagName) - the same expectation callers already meet before
 * building patterns.tags today.
 *
 * Call this at pattern-save time and write the result into
 * patterns.tag_refs - the field every read path (search, display, the
 * admin tags table) actually reads. `tagNames` is still computed by every
 * caller as an ordinary string array, needed as input here even though
 * patterns.tags itself is no longer written.
 *
 * `preferredIds` is an optional norm(tag) -> tags_v2 id override, consulted before the normal
 * resolve-by-name step below. PatternTagsField.tsx populates it two ways: (1)
 * seeded from the pattern's own existing tag_refs (see AdminEditPatternModal.tsx's
 * initialValues) - protects a tag the pattern is already linked to from
 * being silently re-resolved to a different row sharing its name on an
 * unrelated save; (2) from applyManualTagChange/applyKeyTagChange's own
 * aliasPreferredRefs - a typed alias whose target_tag_ref names a specific
 * row (an Author-typed tag can no longer be *picked* from that dropdown at
 * all, filtered out - see useQueryAuthorTagIds - but its alias can still be
 * typed free-solo, and now resolves correctly too). Every other caller
 * omits this parameter and gets exactly the prior behavior.
 */
export async function resolveOrCreateTagRefs(
  tagNames: string[],
  preferredIds?: Map<string, string>,
): Promise<string[]> {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const raw of tagNames) {
    const norm = raw.trim().toLowerCase();
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    const preferredId = preferredIds?.get(norm);
    if (preferredId) {
      ids.push(preferredId);
      continue;
    }
    const resolved = await resolveOrCreateTagV2Row(raw);
    ids.push(resolved.row.id);
  }
  return ids;
}

// ─── Implied tags ─────────────────────────────────────────────────────────────
//
// `implied_tags` is the multi-parent upgrade of `tag_hierarchy`: any number
// of rows can share the same `tag`, unlike tag_hierarchy's
// one-parent-per-child limit.
//
// applyManualTagChange and applyKeyTagChange above call getImpliedTags
// (through addAncestors/pruneOrphanedAncestors), not getAncestors.
// tag_hierarchy stays in place and still backs the admin hierarchy editor
// and getAncestors/getDescendants above - retiring it is a later cleanup,
// not done yet.

export interface TypeImpliedTagRecord {
  id: string;
  tag: string;
  implies_tag: string;
  /**
   * The tags_v2 row id for `tag`/`implies_tag` respectively. Optional -
   * populated by every write path, but an edge created before these
   * existed may still have these empty. getImpliedTags/getTagsImplying
   * below still match by the string fields; TagGraphView.tsx is the one
   * consumer that reads these ref fields directly.
   */
  tag_ref?: string;
  implies_tag_ref?: string;
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

// ─── Tag aliases ──────────────────────────────────────────────────────────────
//
// tag_aliases already existed in the schema before this project - it was
// simply never wired up anywhere. Many-to-one by convention (many aliases
// can point to one root; nothing here stops one alias row pointing at two
// different targets except a unique index on `alias`, if one is added).

export interface TypeTagAliasRecord {
  id: string;
  alias: string;
  target_tag: string;
  /**
   * The tags_v2 row id for `target_tag`. `alias` itself never gets a ref
   * field, deliberately - since an alias like "orca" is allowed to have no
   * tags_v2 row of its own.
   */
  target_tag_ref?: string;
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
 * Does not chase an alias-of-an-alias chain - the admin create/edit flow is
 * expected to enforce that every alias points directly at a root,
 * non-aliased tag; adding a duplicate is simply ignored.
 */
export function resolveTagAlias(tagName: string, aliases: TypeTagAliasRecord[]): string {
  const norm = tagName.toLowerCase();
  const match = aliases.find((a) => a.alias.toLowerCase() === norm);
  return match ? match.target_tag : tagName;
}

/**
 * The alias's target tags_v2 id, if `tagName` is a known alias with a
 * populated `target_tag_ref`. Lets applyManualTagChange/applyKeyTagChange
 * capture which specific row an alias meant, alongside resolveTagAlias's
 * own resolved name - closes a real gap: typing an alias (e.g. one pointing
 * at a non-General tag sharing a name with a General one) loses that
 * specificity the instant it resolves to a plain string, before
 * resolveOrCreateTagRefs's own "prefer General once a name is ambiguous"
 * default ever gets a chance to guess wrong. An alias with no
 * target_tag_ref yet returns undefined, same as if it weren't a known
 * alias at all - falls through to normal resolution.
 */
function findAliasTargetRef(tagName: string, aliases: TypeTagAliasRecord[]): string | undefined {
  const norm = tagName.toLowerCase();
  return aliases.find((a) => a.alias.toLowerCase() === norm)?.target_tag_ref;
}

/**
 * Whether a tag needs the display-only "(artist)" suffix wherever it's shown
 * as a pickable option - originally the Definition Page only, now shared
 * with the tag search dropdown too. True only for an Author-type tag whose
 * stored name doesn't already carry
 * the suffix on its own (a collision-driven override baked directly into the
 * name by AUTHOR_TAG_OVERRIDES in scripts/backfill-author-tags.mjs, e.g. a
 * still-unrenamed "autumn (artist)") - never double it.
 *
 * Purely cosmetic: the tag's own stored name never changes because of this,
 * so a caller that lets someone pick a suffixed option must still resolve it
 * some other way than treating the suffix as part of the name - see
 * HomepageSearchV3.tsx's commitDropdownItem, which commits an author: token
 * instead of the literal label for exactly this reason.
 */
export function tagNeedsArtistSuffix(tag: { tag: string; expand?: { type?: TypeTagTypeRecord } }): boolean {
  const isAuthorType = tag.expand?.type?.name === 'Author';
  const alreadyHasArtistLabel = /\(artist\)\s*$/i.test(tag.tag);
  return isAuthorType && !alreadyHasArtistLabel;
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

// Reads the `tag_usage` view's precomputed count for one tag - reused on the
// Definition Page to link out to "N patterns tagged X" without a second,
// heavier query against `patterns` itself.
export const useQueryGetTagUsageCount = (tag: string) =>
  useQuery({
    queryKey: ['TagUsageCount', tag],
    queryFn: async (): Promise<number> => {
      const safe = escapeTagFilterValue(tag);
      const result = await pocketbase.collection('tag_usage').getList<TypeReadOnlyDatabaseItem>(1, 1, {
        filter: `tag = "${safe}"`,
      });
      return result.items[0]?.count ?? 0;
    },
    enabled: !!tag,
  });
