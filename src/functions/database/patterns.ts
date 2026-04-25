import { useQuery, keepPreviousData, useMutation, queryOptions } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';
import type { TypeAuthData } from '@/functions/database/authentication.ts';

export type TypePatternResponse = {
  collectionId: string;
  collectionName: string;
  id: string;
  name: string;
  description: string;
  instructions: string;
  difficulty: string;
  authors: string[];
  author_manual: string[];
  uploaded_by: string;
  tags: string[];
  pattern_file: string;
  pattern_file_external: string;
  pattern_file_external_link: string;
  opengraph_image: string;
  pieces: number;
  design_width: number;
  design_height: number;
  line_width: number;
  design_width_unit: string;
  design_height_unit: string;
  line_width_unit: string;
  created: string;
  updated: string;
  pattern_key_reference_list: TypePatternKeyReferenceObject[];
  expand?: {
    authors: TypeAuthData[];
  };
};

export type TypePatternKeyReferenceObject = {
  image: string;
  name: string;
};

export type TypePatternKeyTableResponse = {
  id: string;
  name: string;
};

export const useQueryGetAllPatternsByPagination = () => {
  const { filter, pageNumber } = usePatternSearch();

  let includeIsDeletedFilter = `isDeleted = false`;

  if (filter) {
    includeIsDeletedFilter = filter + ' && ' + includeIsDeletedFilter;
  }

  return useQuery({
    queryKey: ['useQueryGetAllPatternsByPagination', filter, pageNumber],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypePatternResponse>> => {
      return await pocketbase.collection('patterns').getList(pageNumber, 25, {
        filter: includeIsDeletedFilter,
        expand: 'authors',
        sort: '-created',
      });
    },
    enabled: !!pageNumber,
    placeholderData: keepPreviousData,
  });
};

export const useQueryGetAllPatternsByPaginationAdmin = (filter: string, page: number, filterIsDeleted = true) => {
  let includeIsDeletedFilter = `isDeleted = ${String(!filterIsDeleted)}`;

  if (filter) {
    includeIsDeletedFilter = filter + ' && ' + includeIsDeletedFilter;
  }

  return useQuery({
    queryKey: ['useQueryGetAllPatternsByPaginationAdmin', filter, page],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypePatternResponse>> => {
      return await pocketbase.collection('patterns').getList(page, 25, {
        filter: includeIsDeletedFilter,
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
  instructions?: string;
  difficulty?: string;
  authors?: string[];
  author_manual?: string[];
  uploaded_by?: string;
  tags: string[];
  pattern_file?: File;
  pattern_file_external?: File;
  pattern_file_external_link?: string;
  pieces: string;
  design_width: string;
  design_height: string;
  line_width: string;
  design_width_unit: string;
  design_height_unit: string;
  line_width_unit: string;
  isDeleted?: boolean;
  pattern_key_reference_list?: TypePatternKeyReferenceObject[];
};

export const useMutationEditPattern = () => {
  return useMutation({
    mutationFn: async (payload: TypePatternCreatePayload): Promise<TypePatternResponse> => {
      const formData = new FormData();

      // Insert the base data first
      formData.append('name', payload?.name || '');
      formData.append('description', payload?.description || '');
      formData.append('tags', JSON.stringify(payload?.tags));
      formData.append('authors', JSON.stringify(payload?.authors));
      formData.append('author_manual', JSON.stringify(payload?.author_manual));
      //formData.append('difficulty', "test");
      formData.append('pieces', payload?.pieces || '1');
      formData.append('design_width', payload?.design_width || '0');
      formData.append('design_height', payload?.design_height || '0');
      formData.append('line_width', payload?.line_width || '0');
      formData.append('design_width_unit', payload?.design_width_unit || 'in');
      formData.append('design_height_unit', payload?.design_height_unit || 'in');
      formData.append('line_width_unit', payload?.line_width_unit || 'in');
      formData.append('pattern_key_reference_list', JSON.stringify(payload?.pattern_key_reference_list));

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

      if (payload?.pattern_file_external) {
        formData.append('pattern_file_external', payload?.pattern_file_external);
      }

      if (payload?.pattern_file_external_link) {
        formData.append('pattern_file_external_link', payload?.pattern_file_external_link || '');
      }

      if (payload?.id) {
        return await pocketbase.collection('patterns').update(payload?.id, formData);
      } else {
        return await pocketbase.collection('patterns').create(formData);
      }
    },
  });
};

export type TypePatternSoftDeletePayload = {
  id: string;
  isDeleted: boolean;
};

export const useMutationSoftDeletePattern = () => {
  return useMutation({
    mutationFn: async (payload: TypePatternSoftDeletePayload): Promise<TypePatternResponse> => {
      return await pocketbase.collection('patterns').update(payload?.id, payload);
    },
  });
};

/** @deprecated: Delete method is now a Soft Delete */
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

// This will query the list of pattern keys
export const useQueryGetAllPatternKeys = () => {
  return useQuery({
    queryKey: ['useQueryGetAllPatternKeys'],
    queryFn: async (): Promise<TypePatternKeyTableResponse[]> => {
      return await pocketbase.collection('pattern_key_reference_images').getFullList();
    },
  });
};
