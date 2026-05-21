import { useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

// ─── Tags view (read-only) ────────────────────────────────────────────────────
//
// The `tags` collection is a PocketBase View Collection generated from a SQL
// SELECT that aggregates pattern tag counts.  It is read-only and its IDs are
// random per-query — do NOT use its IDs as foreign keys.

export const useQueryGetAllTags = () => {
  return useQuery({
    queryKey: ['GetAllTags'],
    queryFn: async (): Promise<TypeReadOnlyDatabaseItem[]> => {
      return await pocketbase.collection('tags').getFullList({
        sort: '-count',
      });
    },
  });
};

// ─── Tag hierarchy (regular collection, fully writable) ──────────────────────
//
// A separate `tag_hierarchy` regular collection stores parent/child
// relationships keyed on lowercase tag name strings — avoiding any dependency
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
 * Guards against circular references — stops after 20 hops.
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
  [key: string]: unknown;
}

export interface TypeTagStat {
  tag: string;
  count: number;
}

/**
 * Fetch ALL patterns (only id + tags fields) for building the tag index.
 * Uses pagination to handle large collections.
 */
async function fetchAllPatternTags(): Promise<TypePatternRecord[]> {
  const records: TypePatternRecord[] = [];
  let page = 1;
  const perPage = 500;

  while (true) {
    const result = await pocketbase
      .collection('patterns')
      .getList<TypePatternRecord>(page, perPage, { fields: 'id,tags' });
    records.push(...result.items);
    if (records.length >= result.totalItems) break;
    page++;
  }

  return records;
}

export const ADMIN_TAG_STATS_QUERY_KEY = ['AdminTagStats'] as const;

export const useQueryAdminTagStats = () => {
  return useQuery({
    queryKey: ADMIN_TAG_STATS_QUERY_KEY,
    queryFn: async (): Promise<TypeTagStat[]> => {
      const records = await fetchAllPatternTags();

      const counts: Record<string, number> = {};

      for (const record of records) {
        const tags = Array.isArray(record.tags) ? record.tags : [];
        for (const tag of tags) {
          if (tag) counts[tag] = (counts[tag] ?? 0) + 1;
        }
      }

      return Object.entries(counts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
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
  /** Free-text filter: tag ~ "value" — sanitised before sending. */
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

      const result = await pocketbase
        .collection('tags')
        .getList<TypeReadOnlyDatabaseItem>(params.page + 1, params.pageSize, {
          sort,
          ...(filter ? { filter } : {}),
        });

      return { items: result.items, totalItems: result.totalItems };
    },
    staleTime: 1000 * 60 * 2,
    placeholderData: (prev) => prev,
  });
};
