import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePatternResponse } from '@/functions/database/patterns';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TypeGalleryResponse = {
  collectionId: string;
  collectionName: string;
  id: string;
  title: string;
  description: string;
  src: string; // ImageKit CDN URL
  imagekit_file_id: string; // For deletion from ImageKit
  pattern_id: string;
  owner_id: string;
  created: Date;
  updated: Date;
  expand?: {
    pattern_id?: TypePatternResponse;
  };
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export const useQueryGetUserGallery = (userId: string, pageNumber: number) => {
  return useQuery({
    queryKey: ['GetUserGallery', userId, pageNumber],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypeGalleryResponse>> => {
      return await pocketbase.collection('gallery').getList(pageNumber, 10, {
        filter: `owner_id = "${userId}"`,
        sort: '-created',
        expand: 'pattern_id',
      });
    },
    enabled: !!pageNumber && !!userId,
    refetchOnMount: 'always',
  });
};

// ─── Mutations ────────────────────────────────────────────────────────────────

export type UpdateGalleryPayload = {
  id: string;
  title: string;
  description: string;
  pattern_id: string; // empty string = clear the relation
};

export const useMutationUpdateGallery = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateGalleryPayload) =>
      pocketbase.collection('gallery').update(payload.id, {
        title: payload.title,
        description: payload.description,
        pattern_id: payload.pattern_id || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['GetUserGallery'] });
    },
  });
};

// ─── Pattern search (used in GalleryUploadDialog / GalleryEditDialog) ─────────

export type TypePatternSearchResult = {
  id: string;
  collectionId: string;
  name: string;
  pattern_file: string;
  pattern_file_external: string;
};

export const useQuerySearchPatternsByName = (term: string) => {
  return useQuery({
    queryKey: ['SearchPatternsByName', term],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypePatternSearchResult>> => {
      let includeIsDeletedFilter = `isDeleted = false && is_draft = false`;

      return await pocketbase.collection('patterns').getList(1, 8, {
        filter: `name ~ "${term.replace(/"/g, '')}" && ${includeIsDeletedFilter}`,
        fields: 'id,collectionId,name,pattern_file,pattern_file_external',
        sort: 'name',
      });
    },
    enabled: term.length >= 2,
    staleTime: 30_000,
  });
};
