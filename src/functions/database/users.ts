import { queryOptions, useMutation, useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import type { TypeAuthData } from '@/functions/database/authentication';

export const useQueryUsersByPagination = (pageNumber: number, filter?: string) => {
  return useQuery({
    queryKey: ['UsersByPagination', pageNumber, filter],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypeAuthData>> => {
      return await pocketbase.collection('users').getList(pageNumber, 25, {
        sort: '-created',
        filter: filter,
      });
    },
  });
};

// ─── Admin users - rich paginated query for the Users admin page ───────────────

export type TypeAdminUsersPaginationParams = {
  /** 0-indexed page (MUI DataGrid convention; +1 before sending to PocketBase). */
  page: number;
  pageSize: number;
  /** Free-text: matches against name OR email. */
  search: string;
  verifiedFilter: 'all' | 'verified' | 'unverified';
};

export const useQueryAdminUsersPaginated = (params: TypeAdminUsersPaginationParams) => {
  return useQuery({
    queryKey: ['AdminUsersPaginated', params],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypeAuthData>> => {
      const filters: string[] = [];
      if (params.search.trim()) {
        const safe = params.search.trim().replace(/"/g, '\\"');
        filters.push(`(name ~ "${safe}" || email ~ "${safe}")`);
      }
      if (params.verifiedFilter === 'verified') filters.push('verified = true');
      else if (params.verifiedFilter === 'unverified') filters.push('verified = false');

      return await pocketbase.collection('users').getList<TypeAuthData>(params.page + 1, params.pageSize, {
        sort: '-created',
        ...(filters.length ? { filter: filters.join(' && ') } : {}),
      });
    },
    placeholderData: (prev) => prev,
  });
};

export const useQueryGetUserById = (id?: string) => {
  return useQuery({
    queryKey: ['GetUserById', id],
    queryFn: async (): Promise<TypeAuthData> => {
      return await pocketbase.collection('users').getOne(id || '');
    },
    enabled: !!id,
  });
};

// This is a fancy thing to handle automate queries for data on dynamic pages
export const getUserByIdOptions = (id: string) =>
  queryOptions({
    queryKey: ['GetUserById', id],
    queryFn: (): Promise<TypeAuthData> => pocketbase.collection('users').getOne(id),
  });

export const useMutationResetUserPassword = () => {
  return useMutation({
    mutationFn: async (email: string): Promise<void> => {
      await pocketbase.collection('users').requestPasswordReset(email);
    },
  });
};

export const useMutationDeleteUser = () => {
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await pocketbase.collection('users').delete(id);
    },
  });
};

export const useMutationValidateUsername = () => {
  return useMutation({
    mutationFn: async (name: string): Promise<TypeAuthData[]> => {
      const filter = pocketbase.filter('name~{:name}', { name });
      return await pocketbase.collection('users').getFullList({
        filter: filter,
        fields: 'name',
      });
    },
  });
};
