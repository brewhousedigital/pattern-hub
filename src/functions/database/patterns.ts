import { useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';

export type TypePatternResponse = {
  collectionId: string;
  collectionName: string;
  id: string;
  name: string;
  tags: string;
  pattern_file: string;
  created: string;
  updated: string;
};

export const useQueryGetAllPatternsByPagination = (searchTerm: string, pageNumber: number) => {
  return useQuery({
    queryKey: ['useQueryGetAllPatternsByPagination', searchTerm, pageNumber],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypePatternResponse>> => {
      return await pocketbase.collection('patterns').getList(pageNumber, 25, {
        sort: '-created',
        filter: searchTerm ? `name ~ '${searchTerm}' || tags ~ '${searchTerm}'` : '',
      });
    },
    enabled: !!pageNumber,
  });
};
