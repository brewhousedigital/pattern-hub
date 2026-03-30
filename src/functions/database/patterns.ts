import { useQuery, keepPreviousData, useMutation, queryOptions } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import { useGlobalSearchPagination } from '@/data/search';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';
import type { TypeAuthData } from '@/functions/database/authentication.ts';

export type TypePatternResponse = {
  collectionId: string;
  collectionName: string;
  id: string;
  name: string;
  description: string;
  difficulty: string;
  authors: string[];
  uploaded_by: string;
  tags: string[];
  pattern_file: string;
  pieces: number;
  design_width: number;
  design_height: number;
  line_width: number;
  design_width_unit: string;
  design_height_unit: string;
  line_width_unit: string;
  created: string;
  updated: string;
  expand?: {
    authors: TypeAuthData[];
  };
};

export const useQueryGetAllPatternsByPagination = () => {
  const { page } = useGlobalSearchPagination();
  const { filter } = usePatternSearch();

  return useQuery({
    queryKey: ['useQueryGetAllPatternsByPagination', filter, page],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypePatternResponse>> => {
      return await pocketbase.collection('patterns').getList(page, 25, {
        filter,
        expand: 'authors',
        sort: '-created',
      });
    },
    enabled: !!page,
    placeholderData: keepPreviousData,
  });
};

export const useQueryGetAllPatternsByPaginationAdmin = (filter: string, page: number) => {
  return useQuery({
    queryKey: ['useQueryGetAllPatternsByPaginationAdmin', filter, page],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypePatternResponse>> => {
      return await pocketbase.collection('patterns').getList(page, 25, {
        filter,
        expand: 'authors',
        sort: '-created',
      });
    },
    enabled: !!page,
    placeholderData: keepPreviousData,
  });
};

export type TypePatternCreatePayload = {
  id?: string;
  name: string;
  description: string;
  difficulty?: string;
  authors?: string;
  uploaded_by?: string;
  tags: string;
  pattern_file?: File;
  pieces: string;
  design_width: string;
  design_height: string;
  line_width: string;
  design_width_unit: string;
  design_height_unit: string;
  line_width_unit: string;
};

export const useMutationEditPattern = () => {
  return useMutation({
    mutationFn: async (payload: TypePatternCreatePayload): Promise<TypePatternResponse> => {
      const formData = new FormData();

      // Insert the base data first
      formData.append('name', payload?.name || '');
      formData.append('description', payload?.description || '');
      formData.append('tags', payload?.tags || '');
      formData.append('authors', payload?.authors || '');
      //formData.append('difficulty', "test");
      formData.append('pieces', payload?.pieces || '1');
      formData.append('design_width', payload?.design_width || '0');
      formData.append('design_height', payload?.design_height || '0');
      formData.append('line_width', payload?.line_width || '0');
      formData.append('design_width_unit', payload?.design_width_unit || 'in');
      formData.append('design_height_unit', payload?.design_height_unit || 'in');
      formData.append('line_width_unit', payload?.line_width_unit || 'in');

      if (payload?.uploaded_by) {
        formData.append('uploaded_by', payload?.uploaded_by || '');
      }

      // This is a new entry
      if (payload?.id) {
        formData.append('id', payload.id);
      }

      // If this has a file upload, add it
      if (payload?.pattern_file) {
        formData.append('pattern_file', payload?.pattern_file);
      }

      if (payload?.id) {
        return await pocketbase.collection('patterns').update(payload?.id, formData);
      } else {
        return await pocketbase.collection('patterns').create(formData);
      }
    },
  });
};

export const useMutationDeletePattern = () => {
  return useMutation({
    mutationFn: async (patternId: string) => {
      await pocketbase.collection('patterns').delete(patternId);
    },
  });
};

export const useQueryGetPatternById = (patternId: string) => {
  return useQuery({
    queryKey: ['useQueryGetPatternById', patternId],
    queryFn: async (): Promise<TypePatternResponse> => {
      return await pocketbase.collection('patterns').getOne(patternId);
    },
  });
};

// This is a fancy thing to handle automate queries for data on dynamic pages
export const getPatternByIdOptions = (patternId: string) =>
  queryOptions({
    queryKey: ['getPatternByIdOptions', patternId],
    queryFn: () => pocketbase.collection('patterns').getOne(patternId),
  });
