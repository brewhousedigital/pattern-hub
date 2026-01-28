import { useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';

export type TypePatternResponse = {
  collectionId: string;
  collectionName: string;
  id: string;
  name: string;
  description: string;
  difficulty: string;
  authors: string;
  tags: string;
  pattern_file: string;
  created: string;
  updated: string;
};

export const useQueryGetAllPatternsByPagination = (searchTerm: string, pageNumber: number, tag: string) => {
  return useQuery({
    queryKey: ['useQueryGetAllPatternsByPagination', searchTerm, pageNumber, tag],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypePatternResponse>> => {
      let filter = '';

      if (searchTerm) {
        filter += `(name ~ '${searchTerm}' || description ~ '${searchTerm}' || authors ~ '${searchTerm}' || difficulty ~ '${searchTerm}') `;
      }

      if (tag) {
        if (filter) {
          filter += '&& ';
        }
        filter += `(tags ~ '${tag}') `;
      }

      return await pocketbase.collection('patterns').getList(pageNumber, 25, {
        sort: '-created',
        filter: filter,
      });
    },
    enabled: !!pageNumber,
  });
};
