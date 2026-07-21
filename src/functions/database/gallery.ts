import { useQuery } from '@tanstack/react-query';
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
      const includeIsDeletedFilter = `isDeleted = false && is_draft = false`;

      return await pocketbase.collection('patterns').getList(1, 8, {
        filter: `name ~ "${term.replace(/"/g, '')}" && ${includeIsDeletedFilter}`,
        fields: 'id,collectionId,name,pattern_file,pattern_file_external',
        sort: 'name',
      });
    },
    enabled: term.length >= 2,
  });
};
