import { useMutation, useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import type { TypeAuthData } from '@/functions/database/authentication';

export const useQueryUsersByPagination = (pageNumber: number, filter?: string) => {
  return useQuery({
    queryKey: ['UsersByPagination'],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypeAuthData>> => {
      return await pocketbase.collection('users').getList(pageNumber, 25, {
        sort: '-created',
        filter: filter,
      });
    },
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

export const useMutationValidateUsername = () => {
  return useMutation({
    mutationFn: async (name: string): Promise<TypePaginationDatabaseResponse<TypeAuthData>> => {
      return await pocketbase.collection('users').getFirstListItem(`name="${name}"`, {
        fields: 'name',
      });
    },
  });
};
