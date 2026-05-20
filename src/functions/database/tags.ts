import { useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

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

// ─── Paginated tag stats (backed by the `tags` collection) ────────────────────
//
// Replaces the "All Tags" table usage of useQueryAdminTagStats, which scanned
// every pattern record and was hitting PocketBase request limits.  The `tags`
// collection already stores pre-computed counts so this is a simple getList call.

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
    placeholderData: (prev) => prev, // keep previous page visible while next page loads
  });
};
