import { useQuery, keepPreviousData } from '@tanstack/react-query';
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

export const useQueryGetAllPatternsByPagination = (searchTerm: string, pageNumber: number) => {
  return useQuery({
    queryKey: ['useQueryGetAllPatternsByPagination', searchTerm, pageNumber],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypePatternResponse>> => {
      let filter = '';

      if (searchTerm) {
        const terms = searchTerm.trim().split(/\s+/); // Split by whitespace
        const includeTags: string[] = [];
        const excludeTags: string[] = [];

        terms.forEach((term) => {
          if (term.startsWith('-')) {
            // Exclude tag (remove the - prefix)
            excludeTags.push(term.slice(1));
          } else {
            // Include tag
            includeTags.push(term);
          }
        });

        const filterParts: string[] = [];

        // Add include filters
        if (includeTags.length > 0) {
          const includeFilters = includeTags.map((tag) => `tags ~ "${tag}"`);
          filterParts.push(`(${includeFilters.join(' && ')})`);
        }

        // Add exclude filters
        if (excludeTags.length > 0) {
          const excludeFilters = excludeTags.map((tag) => `tags !~ "${tag}"`);
          filterParts.push(`(${excludeFilters.join(' && ')})`);
        }

        filter = filterParts.join(' && ');
      }

      console.log('>>>filter', filter);

      return await pocketbase.collection('patterns').getList(pageNumber, 25, {
        sort: '-created',
        filter: filter,
      });
    },
    enabled: !!pageNumber,
    placeholderData: keepPreviousData,
  });
};
