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

export const useQueryAdminTagStats = () => {
  return useQuery({
    queryKey: ['AdminTagStats'],
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
