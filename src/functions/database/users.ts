import { useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import type { TypeAuthData } from '@/functions/database/authentication';

export const useQueryUsersByPagination = (pageNumber: number, filter?: string) => {
  return useQuery({
    queryKey: ['useQueryUsersByPagination'],
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
    queryKey: ['useQueryGetUserById', id],
    queryFn: async (): Promise<TypeAuthData> => {
      return await pocketbase.collection('users').getOne(id || '');
    },
    enabled: !!id,
  });
};
