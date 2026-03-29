import { useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import type { TypeAuthData } from '@/functions/database/authentication';

export const useQueryUsersByPagination = (pageNumber: number) => {
  return useQuery({
    queryKey: ['useQueryUsersByPagination'],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypeAuthData>> => {
      return await pocketbase.collection('users').getList(1, 25, {
        sort: '-created',
      });
    },
  });
};
