import { useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

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
    staleTime: 1000 * 60 * 2,
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
    staleTime: 1000 * 60 * 5,
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
    staleTime: 1000 * 60 * 2,
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
    staleTime: 1000 * 60 * 2,
    placeholderData: (prev) => prev,
  });
};
