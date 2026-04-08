import { useMutation, useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import type { TypeAuthData } from '@/functions/database/authentication';
import type { TypeLevelsAdmin } from '@/functions/database/authentication';

export const useQueryAdminUsersByPagination = (pageNumber: number, filter?: string) => {
  return useQuery({
    queryKey: ['useQueryAdminUsersByPagination'],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypeAuthData>> => {
      return await pocketbase.collection('admins').getList(pageNumber, 100, {
        sort: '-created',
        filter: filter,
      });
    },
  });
};

type CreateUserPayload = {
  name: string;
  email: string;
  emailVisibility: boolean;
  level: [];
  password: string;
  passwordConfirm: string;
};

export const useMutationCreateAdminUser = () => {
  return useMutation({
    mutationFn: async (payload: CreateUserPayload) => {
      await pocketbase.collection('admins').create(payload);
    },
  });
};

export const useMutationResetAdminUser = () => {
  return useMutation({
    mutationFn: async (email: string) => {
      await pocketbase.collection('admins').requestPasswordReset(email);
    },
  });
};

type UpdateUserPayload = {
  id: string;
  level?: TypeLevelsAdmin[];
};

export const useMutationUpdateAdminUser = () => {
  return useMutation({
    mutationFn: async (payload: UpdateUserPayload) => {
      await pocketbase.collection('admins').update(payload.id || '', payload);
    },
  });
};

export const useMutationDeleteAdminUser = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      await pocketbase.collection('admins').delete(id || '');
    },
  });
};
