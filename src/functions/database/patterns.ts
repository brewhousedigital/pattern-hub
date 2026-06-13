import { useQuery, keepPreviousData, useMutation, queryOptions } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';
import type { TypeAuthData } from '@/functions/database/authentication';
import dayjs, { Dayjs } from 'dayjs';

export type TypePatternResponse = {
  collectionId: string;
  collectionName: string;
  id: string;
  name: string;
  description: string;
  instructions: string;
  source_url?: string;
  difficulty: string;
  authors: string[];
  author_manual: string[];
  uploaded_by: string;
  design_date: Date | Dayjs | null;
  tags: string[];
  pattern_file: string;
  pattern_file_external: string;
  pattern_file_size?: number;
  pattern_file_external_link: string;
  opengraph_image: string;
  pieces: number;
  design_width: number;
  design_height: number;
  line_width: number;
  design_width_unit: string;
  design_height_unit: string;
  line_width_unit: string;
  has_layers: boolean;
  layers_map: TypePatternLayersMapItem[];
  size_width_in?: number;
  size_width_cm?: number;
  size_width_mm?: number;
  size_height_in?: number;
  size_height_cm?: number;
  size_height_mm?: number;
  tag_count?: number;
  avg_rating?: number;
  total_ratings?: number;
  avg_difficulty?: number;
  total_difficulty_ratings?: number;
  favorite_count?: number;
  created: string;
  updated: string;
  pattern_key_reference_list: TypePatternKeyReferenceObject[];
  expand?: {
    authors: TypeAuthData[];
  };
};

export type TypePatternLayersMapItem = {
  layerName: string;
  mappedName: string;
  isVisible: boolean;
};

export type TypePatternKeyReferenceObject = {
  image: string;
  name: string;
  fullPath?: string;
};

export type TypePatternKeyTableResponse = {
  id: string;
  name: string;
  fullPath?: string;
  isDeleted: boolean;
};

export const useQueryGetAllPatternsByPagination = () => {
  const { filter, pageNumber, sort } = usePatternSearch();

  let includeIsDeletedFilter = `isDeleted = false`;

  if (filter) {
    includeIsDeletedFilter = filter + ' && ' + includeIsDeletedFilter;
  }

  return useQuery({
    queryKey: ['GetAllPatternsByPagination', filter, pageNumber, sort],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypePatternResponse>> => {
      return await pocketbase.collection('patterns').getList(pageNumber, 20, {
        filter: includeIsDeletedFilter,
        expand: 'authors',
        sort,
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
    queryKey: ['GetAllPatternsByPaginationAdmin', filter, page],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypePatternResponse>> => {
      return await pocketbase.collection('patterns').getList(page, 20, {
        filter: includeIsDeletedFilter,
        expand: 'authors',
        sort: '-created',
      });
    },
    enabled: !!page,
    placeholderData: keepPreviousData,
  });
};

export const useQueryGetPatternsByAuthor = (userId: string, page: number) => {
  return useQuery({
    queryKey: ['GetPatternsByAuthor', userId, page],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypePatternResponse>> => {
      return await pocketbase.collection('patterns').getList(page, 12, {
        filter: `authors ~ '${userId}' && isDeleted = false`,
        sort: '-created',
      });
    },
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });
};

export type TypePatternCreatePayload = {
  id?: string;
  name: string;
  description: string;
  instructions?: string;
  source_url?: string;
  difficulty?: string;
  authors?: string[];
  author_manual?: string[];
  uploaded_by?: string;
  tags: string[];
  pattern_file?: File;
  pattern_file_size?: number;
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
  design_date?: Date | Dayjs | null;
  has_layers?: boolean;
  layers_map?: TypePatternLayersMapItem[];
};

function r4(n: number) { return Math.round(n * 10000) / 10000; }

function convertToAllUnits(value: number, unit: string) {
  if (unit === 'cm') return { in: r4(value / 2.54),  cm: r4(value),       mm: r4(value * 10)  };
  if (unit === 'mm') return { in: r4(value / 25.4),  cm: r4(value / 10),  mm: r4(value)       };
  return               { in: r4(value),         cm: r4(value * 2.54), mm: r4(value * 25.4) };
}

export const useMutationEditPattern = () => {
  return useMutation({
    mutationFn: async (payload: TypePatternCreatePayload): Promise<TypePatternResponse> => {
      const formData = new FormData();

      // Insert the base data first
      formData.append('name', payload?.name || '');
      formData.append('description', payload?.description || '');
      formData.append('source_url', payload?.source_url || '');
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
        formData.append('pattern_file_size', String(payload?.pattern_file_size || 0));
      }

      if (payload?.pattern_file_external) {
        formData.append('pattern_file_external', payload?.pattern_file_external);
      }

      if (payload?.pattern_file_external_link) {
        formData.append('pattern_file_external_link', payload?.pattern_file_external_link || '');
      }

      if (payload?.design_date) {
        const dateString = dayjs(payload?.design_date).startOf('day').toISOString();
        formData.append('design_date', dateString || '');
      }

      const wConverted = convertToAllUnits(parseFloat(payload?.design_width || '0'), payload?.design_width_unit || 'in');
      const hConverted = convertToAllUnits(parseFloat(payload?.design_height || '0'), payload?.design_height_unit || 'in');
      formData.append('size_width_in', String(wConverted.in));
      formData.append('size_width_cm', String(wConverted.cm));
      formData.append('size_width_mm', String(wConverted.mm));
      formData.append('size_height_in', String(hConverted.in));
      formData.append('size_height_cm', String(hConverted.cm));
      formData.append('size_height_mm', String(hConverted.mm));

      formData.append('has_layers', String(payload?.has_layers ?? false));
      formData.append('layers_map', JSON.stringify(payload?.layers_map ?? []));
      formData.append('tag_count', String(payload?.tags?.length ?? 0));

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

export type TypePatternUpdateInstructionsPayload = {
  id: string;
  instructions: string;
};

export const useMutationUpdateInstructionsPattern = () => {
  return useMutation({
    mutationFn: async (payload: TypePatternUpdateInstructionsPayload): Promise<TypePatternResponse> => {
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
    queryKey: ['GetPatternById', patternId],
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
    queryKey: ['GetAllPatternKeys'],
    queryFn: async (): Promise<TypePatternKeyTableResponse[]> => {
      return await pocketbase.collection('pattern_key_reference_images').getFullList({
        filter: 'isDeleted = false',
      });
    },
  });
};

export const useMutationSavePatternKey = () => {
  return useMutation({
    mutationFn: async (file: File): Promise<TypePatternResponse> => {
      const form = new FormData();
      form.append('name', file);
      return await pocketbase.collection('pattern_key_reference_images').create(form);
    },
  });
};

export const useMutationSoftDeletePatternKey = () => {
  return useMutation({
    mutationFn: async (id: string): Promise<TypePatternResponse> => {
      return await pocketbase.collection('pattern_key_reference_images').update(id, { isDeleted: true });
    },
  });
};

export type TypePatternKeyCollectionResponse = {
  id: string;
  name: string;
  collection: TypePatternKeyReferenceObject[];
  created: Date;
};

export const useQueryGetAllPatternKeyCollections = () => {
  return useQuery({
    queryKey: ['GetAllPatternKeyCollections'],
    queryFn: async (): Promise<TypePatternKeyCollectionResponse[]> => {
      return await pocketbase.collection('pattern_key_reference_collections').getFullList();
    },
  });
};

export type TypeSavePatternKeyCollectionPayload = {
  id?: string;
  name: string;
  collection: TypePatternKeyReferenceObject[];
};

export const useMutationSavePatternKeyCollection = () => {
  return useMutation({
    mutationFn: async (payload: TypeSavePatternKeyCollectionPayload): Promise<TypePatternKeyCollectionResponse> => {
      if (payload?.id) {
        return await pocketbase.collection('pattern_key_reference_collections').update(payload.id, payload);
      } else {
        return await pocketbase.collection('pattern_key_reference_collections').create(payload);
      }
    },
  });
};

export const useMutationDeletePatternKeyCollection = () => {
  return useMutation({
    mutationFn: async (id: string): Promise<boolean> => {
      return await pocketbase.collection('pattern_key_reference_collections').delete(id);
    },
  });
};

export type TypePatternReferenceKeyView = {
  id: string;
  fullPath: string;
  name: string;
  count: number;
  pattern_ids: string[];
};

export const useQueryGetPatternReferenceKeys = () => {
  return useQuery({
    queryKey: ['GetPatternReferenceKeys'],
    queryFn: async (): Promise<TypePatternReferenceKeyView[]> => {
      return await pocketbase.collection('view_pattern_reference_keys').getFullList({
        sort: '-count',
      });
    },
  });
};
