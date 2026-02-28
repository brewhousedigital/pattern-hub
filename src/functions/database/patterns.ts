import { useQuery, keepPreviousData, useMutation } from '@tanstack/react-query';
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
  pieces: number;
  design_width: number;
  design_height: number;
  line_width: number;
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

export type TypePatternCreatePayload = {
  id?: string;
  name: string;
  description: string;
  difficulty?: string;
  authors?: string;
  tags: string;
  pattern_file?: File;
  pieces: string;
  design_width: string;
  design_height: string;
  line_width: string;
};

export const useMutationEditPattern = () => {
  return useMutation({
    mutationFn: async (payload: TypePatternCreatePayload) => {
      const formData = new FormData();

      // Insert the base data first
      formData.append('name', payload?.name || '');
      formData.append('description', payload?.description || '');
      formData.append('tags', payload?.tags || '');
      //formData.append('authors', "test");
      //formData.append('difficulty', "test");
      formData.append('pieces', payload?.pieces || '');
      formData.append('design_width', payload?.design_width || '');
      formData.append('design_height', payload?.design_height || '');
      formData.append('line_width', payload?.line_width || '');

      // This is a new entry
      if (payload?.id) {
        formData.append('id', payload.id);
      }

      // If this has a file upload, add it
      if (payload?.pattern_file) {
        formData.append('pattern_file', payload?.pattern_file);
      }

      if (payload?.id) {
        await pocketbase.collection('patterns').update(payload?.id, formData);
      } else {
        await pocketbase.collection('patterns').create(formData);
      }
    },
  });
};
