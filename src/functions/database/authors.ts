import { useQuery } from '@tanstack/react-query';
import { pocketbase, pocketbaseDomain } from '@/functions/database/authentication-setup';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';
import type { TypeAuthData } from '@/functions/database/authentication';

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

export const useQuerySearchLinkedAuthors = (search: string) => {
  return useQuery({
    queryKey: ['SearchLinkedAuthors', search],
    queryFn: async (): Promise<TypeAuthData[]> => {
      const safe = search.trim().replace(/"/g, '\\"');
      const result = await pocketbase.collection('users').getList<TypeAuthData>(1, 25, {
        sort: 'name',
        ...(safe ? { filter: `name ~ "${safe}"` } : {}),
      });
      return result.items;
    },
    staleTime: 1000 * 60 * 2,
    placeholderData: (prev) => prev,
  });
};

// Resolves author-search names to real user ids via a narrow server-side
// lookup (see pb_hooks/main.pb.js /api/resolve-author-ids). Needed because
// filtering patterns by "authors.name" directly would join into the `users`
// collection, whose List rule is now admin-only - the join silently returns
// nothing for everyone else. This sidesteps that by filtering the `authors`
// relation field by id instead, which needs no join.
export const useQueryResolveAuthorUserIds = (names: string[]) => {
  const sortedNames = [...new Set(names)].sort();

  return useQuery({
    queryKey: ['ResolveAuthorUserIds', sortedNames.join(',')],
    queryFn: async (): Promise<Record<string, string[]>> => {
      const res = await fetch(
        `${pocketbaseDomain}/api/resolve-author-ids?names=${encodeURIComponent(sortedNames.join(','))}`,
      );
      if (!res.ok) throw new Error('Failed to resolve author ids');
      return res.json();
    },
    enabled: sortedNames.length > 0,
    staleTime: 1000 * 60 * 5,
  });
};

export const useQuerySearchManualAuthors = (search: string) => {
  return useQuery({
    queryKey: ['SearchManualAuthors', search],
    queryFn: async (): Promise<TypeReadOnlyDatabaseItem[]> => {
      const safe = search.trim().replace(/"/g, '\\"');
      const filters = ['manual > 0'];
      if (safe) filters.push(`tag ~ "${safe}"`);
      const result = await pocketbase.collection('authors').getList<TypeReadOnlyDatabaseItem>(1, 50, {
        sort: '-count',
        filter: filters.join(' && '),
      });
      return result.items;
    },
    staleTime: 1000 * 60 * 2,
    placeholderData: (prev) => prev,
  });
};
