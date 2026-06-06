import { useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

export const useQuerySearchAuthors = (searchTerm: string, enabled = true) => {
  return useQuery({
    queryKey: ['SearchAuthors', searchTerm],
    queryFn: async (): Promise<TypeReadOnlyDatabaseItem[]> => {
      const safe = searchTerm.trim().replace(/"/g, '\\"');
      const result = await pocketbase.collection('authors').getList<TypeReadOnlyDatabaseItem>(1, 100, {
        sort: '-count',
        ...(safe ? { filter: `tag ~ "${safe}"` } : {}),
      });
      return result.items;
    },
    enabled,
    staleTime: 1000 * 60 * 2,
    placeholderData: (prev) => prev,
  });
};

export const useQueryGetAllAuthors = () => {
  return useQuery({
    queryKey: ['GetAllAuthors'],
    queryFn: async (): Promise<TypeReadOnlyDatabaseItem[]> => {
      return await pocketbase.collection('authors').getFullList();
    },
  });
};

export const useQueryGetAllManualAuthors = () => {
  return useQuery({
    queryKey: ['GetAllManualAuthors'],
    queryFn: async (): Promise<TypeReadOnlyDatabaseItem[]> => {
      return await pocketbase.collection('authors').getFullList({
        filter: 'manual > 0',
      });
    },
  });
};
