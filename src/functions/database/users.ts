import { queryOptions, useMutation, useQuery } from '@tanstack/react-query';
import { pocketbase, pocketbaseDomain } from '@/functions/database/authentication-setup';
import { useAuthorizationHeaders } from '@/functions/database/useAuthorizationHeaders';
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
  bannedFilter: 'all' | 'banned' | 'active';
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
      if (params.bannedFilter === 'banned') filters.push('banned = true');
      else if (params.bannedFilter === 'active') filters.push('banned != true');

      return await pocketbase.collection('users').getList<TypeAuthData>(params.page + 1, params.pageSize, {
        sort: '-created',
        ...(filters.length ? { filter: filters.join(' && ') } : {}),
      });
    },
    placeholderData: (prev) => prev,
  });
};

// `identifier` is a raw PocketBase record id today (see isPocketBaseId). Once
// custom profile vanity slugs ship, branch here: when isPocketBaseId(identifier)
// is false, look up by the slug field instead of calling getOne.
export const useQueryGetUserById = (identifier?: string) => {
  return useQuery({
    queryKey: ['GetUserById', identifier],
    queryFn: async (): Promise<TypeAuthData> => {
      return await pocketbase.collection('users').getOne(identifier || '');
    },
    enabled: !!identifier,
  });
};

// This is a fancy thing to handle automate queries for data on dynamic pages
export const getUserByIdOptions = (identifier: string) =>
  queryOptions({
    queryKey: ['GetUserById', identifier],
    queryFn: (): Promise<TypeAuthData> => pocketbase.collection('users').getOne(identifier),
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

// ─── Ban / name-reset admin actions ─────────────────────────────────────────
// Both go through pb_hooks admin endpoints ($apis.requireAuth('admins')) rather
// than the records API, so they work regardless of the users collection rules.

export const useMutationSetUserBanned = () => {
  const authHeaders = useAuthorizationHeaders('POST');
  return useMutation({
    mutationFn: async (payload: { userId: string; banned: boolean; reason?: string }): Promise<void> => {
      const res = await fetch(`${pocketbaseDomain}/api/admin-ban-user`, {
        ...authHeaders,
        body: JSON.stringify({ userId: payload.userId, banned: payload.banned, reason: payload.reason ?? '' }),
      });
      if (!res.ok) throw new Error('Failed to update ban status');
    },
  });
};

export const useMutationResetUserName = () => {
  const authHeaders = useAuthorizationHeaders('POST');
  return useMutation({
    mutationFn: async (userId: string): Promise<{ name: string }> => {
      const res = await fetch(`${pocketbaseDomain}/api/admin-reset-user-name`, {
        ...authHeaders,
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error('Failed to reset user name');
      return res.json();
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
