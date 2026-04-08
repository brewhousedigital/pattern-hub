import { useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import type { TypeAuthData } from '@/functions/database/authentication';

export const useQueryAdminUsersByPagination = (pageNumber: number, filter?: string) => {
  return useQuery({
    queryKey: ['useQueryAdminUsersByPagination'],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypeAuthData>> => {
      return await pocketbase.collection('admins').getList(pageNumber, 25, {
        sort: '-created',
        filter: filter,
      });
    },
  });
};
