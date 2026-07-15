import { useQuery, keepPreviousData, useMutation, queryOptions } from '@tanstack/react-query';
import { pocketbase, pocketbaseDomain } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';
import type { AuthorToken, TagToken, Token } from '@/functions/utilities/search-v2';
import { useQueryResolveAuthorUserIds } from '@/functions/database/authors';
import type { TypeAuthData } from '@/functions/database/authentication';
import { useGlobalAuthData } from '@/data/auth-data';
import { useSessionUnblockedTags } from '@/data/blocked-tags-session';
import { sanitizeSvg } from '@/functions/utilities/sanitize-svg';
import dayjs, { type Dayjs } from 'dayjs';

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
  is_draft: boolean;
  tag_count?: number;
  avg_rating?: number;
  total_ratings?: number;
  avg_difficulty?: number;
  total_difficulty_ratings?: number;
  favorite_count?: number;
  done_count?: number;
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

export type TypePatternSearchResponse = TypePaginationDatabaseResponse<TypePatternResponse> & {
  // Tag counts across the ENTIRE filtered result set (not just this page) -
  // computed server-side in pb_hooks/main.pb.js's /api/pattern-search so the
  // sidebar's "Flower (7)" reflects the full search, not one 20-item page.
  tagFacets: { tag: string; count: number }[];
};

function buildPatternSearchParams(
  tokens: Token[],
  authorIdMap: Record<string, string[]> | undefined,
  blockedTags: string[],
  sort: string,
  pageNumber: number,
): URLSearchParams {
  return new URLSearchParams({
    tokens: JSON.stringify(tokens),
    authorIdMap: JSON.stringify(authorIdMap ?? {}),
    blockedTags: JSON.stringify(blockedTags),
    sort,
    pageNumber: String(pageNumber),
  });
}

export const useQueryGetAllPatternsByPagination = () => {
  const { pageNumber, sort, tokens } = usePatternSearch();
  const { authData } = useGlobalAuthData();

  // Author tokens can't be matched via the "authors.name" relation join
  // anymore (see useQueryResolveAuthorUserIds) - resolve them to real user
  // ids up front so the server can filter the `authors` relation directly
  // instead.
  const authorNames = tokens.filter((t): t is AuthorToken => t.type === 'author').map((t) => t.value);
  const { data: authorIdMap } = useQueryResolveAuthorUserIds(authorNames);

  // Silently exclude the user's blocked tags - unless they've explicitly
  // searched for that exact tag right now, in which case honor the search
  // (avoids a confusing "0 results, no explanation" dead end).
  const activeTagValues = new Set(
    tokens.filter((t): t is TagToken => t.type === 'tag' && !t.exclude).map((t) => t.value.toLowerCase()),
  );
  // Tags temporarily un-blocked for this session via the BlockedTagsBanner
  // dropdown also stop filtering (the query key below includes the effective
  // list, so toggling one refetches automatically).
  const { unblockedTags } = useSessionUnblockedTags();
  const sessionUnblocked = new Set(unblockedTags.map((t) => t.toLowerCase()));
  const effectiveBlockedTags = (authData?.blocked_tags ?? []).filter(
    (tag) => !activeTagValues.has(tag.toLowerCase()) && !sessionUnblocked.has(tag.toLowerCase()),
  );

  return useQuery({
    queryKey: [
      'GetAllPatternsByPagination',
      JSON.stringify(tokens),
      pageNumber,
      sort,
      effectiveBlockedTags.join(','),
      JSON.stringify(authorIdMap ?? {}),
    ],
    queryFn: async (): Promise<TypePatternSearchResponse> => {
      const params = buildPatternSearchParams(tokens, authorIdMap, effectiveBlockedTags, sort, pageNumber);
      const res = await fetch(`${pocketbaseDomain}/api/pattern-search?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to search patterns');
      return res.json();
    },
    enabled: !!pageNumber,
    placeholderData: keepPreviousData,
  });
};

// Prefetches the anonymous, first-page, default-sort view (queryKey matches what
// useQueryGetAllPatternsByPagination produces for a logged-out visitor with no
// search/filter active) so crawlers/first paint see real pattern data instead of
// an empty grid, without replicating the full search/blocked-tags hook machinery.
export const getHomepageDefaultPatternsOptions = () =>
  queryOptions({
    // Key must stay in sync with useQueryGetAllPatternsByPagination's key for
    // the anonymous/default view: no tokens, page 1, default sort, no blocked
    // tags, empty author-id map.
    queryKey: ['GetAllPatternsByPagination', '[]', 1, '-created', '', '{}'],
    queryFn: async (): Promise<TypePatternSearchResponse> => {
      const params = buildPatternSearchParams([], {}, [], '-created', 1);
      const res = await fetch(`${pocketbaseDomain}/api/pattern-search?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to search patterns');
      return res.json();
    },
  });

export const useQueryGetAllPatternsByPaginationAdmin = (
  filter: string,
  page: number,
  sort = '-created',
  filterIsDeleted = true,
) => {
  let includeIsDeletedFilter = `isDeleted = ${String(!filterIsDeleted)}`;

  if (filter) {
    includeIsDeletedFilter = filter + ' && ' + includeIsDeletedFilter;
  }

  return useQuery({
    queryKey: ['GetAllPatternsByPaginationAdmin', filter, page, sort],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypePatternResponse>> => {
      // perPage must match the DataGrid's pageSize (25) or the grid's page
      // ranges drift from the server's
      return await pocketbase.collection('patterns').getList(page, 25, {
        filter: includeIsDeletedFilter,
        expand: 'authors',
        sort,
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
      return await pocketbase.collection('patterns').getList(page, 8, {
        filter: `authors ~ '${userId}' && isDeleted = false && is_draft = false`,
        sort: '-created',
      });
    },
    enabled: !!userId,
    placeholderData: keepPreviousData,
  });
};

// Used by the "Featured Pattern" picker on the profile edit page - every pattern
// the given user is a (linked) author of, for choosing which one to spotlight.
export const useQueryGetOwnPatternsForPicker = (userId: string) => {
  return useQuery({
    queryKey: ['OwnPatternsForPicker', userId],
    queryFn: async (): Promise<TypePatternResponse[]> => {
      const result = await pocketbase.collection('patterns').getFullList<TypePatternResponse>({
        filter: `authors ~ '${userId}' && isDeleted = false && is_draft = false`,
        sort: 'name',
        fields: 'id,collectionId,name,pattern_file,pattern_file_external',
      });
      return result;
    },
    enabled: !!userId,
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
  is_draft?: boolean;
};

function r4(n: number) {
  return Math.round(n * 10000) / 10000;
}

function convertToAllUnits(value: number, unit: string) {
  if (unit === 'cm') return { in: r4(value / 2.54), cm: r4(value), mm: r4(value * 10) };
  if (unit === 'mm') return { in: r4(value / 25.4), cm: r4(value / 10), mm: r4(value) };
  return { in: r4(value), cm: r4(value * 2.54), mm: r4(value * 25.4) };
}

export const useMutationEditPattern = () => {
  return useMutation({
    mutationFn: async (payload: TypePatternCreatePayload): Promise<TypePatternResponse> => {
      const formData = new FormData();

      // Insert the base data first
      formData.append('name', payload?.name || '');
      formData.append('description', payload?.description || '');
      formData.append('instructions', payload?.instructions || '');
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

      const wConverted = convertToAllUnits(
        parseFloat(payload?.design_width || '0'),
        payload?.design_width_unit || 'in',
      );
      const hConverted = convertToAllUnits(
        parseFloat(payload?.design_height || '0'),
        payload?.design_height_unit || 'in',
      );
      formData.append('size_width_in', String(wConverted.in));
      formData.append('size_width_cm', String(wConverted.cm));
      formData.append('size_width_mm', String(wConverted.mm));
      formData.append('size_height_in', String(hConverted.in));
      formData.append('size_height_cm', String(hConverted.cm));
      formData.append('size_height_mm', String(hConverted.mm));

      formData.append('has_layers', String(payload?.has_layers ?? false));
      formData.append('layers_map', JSON.stringify(payload?.layers_map ?? []));
      formData.append('tag_count', String(payload?.tags?.length ?? 0));
      formData.append('is_draft', String(payload?.is_draft ?? false));

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

// Fetches + sanitizes the raw SVG text for layered patterns (PatternViewContent's
// layer toggles). Keyed on the file URL, so React Query handles both caching
// (revisiting a pattern reuses the cached SVG) and races - a slow response for
// pattern A can never land under pattern B's key during rapid next/prev in the
// drawer. Client-only in practice: plain useQuery doesn't fetch during SSR.
export const useQueryPatternLayerSvg = (svgUrl: string | null) =>
  useQuery({
    queryKey: ['PatternLayerSvg', svgUrl],
    queryFn: async (): Promise<string> => {
      const res = await fetch(svgUrl!);
      if (!res.ok) throw new Error('Failed to load pattern SVG');
      return sanitizeSvg(await res.text());
    },
    enabled: !!svgUrl,
  });

// Shared between the /pattern/$patternId route loader and useQueryGetPatternById
// so the key and fetcher can't drift apart.
export const getPatternByIdOptions = (patternId: string) =>
  queryOptions({
    queryKey: ['GetPatternById', patternId],
    queryFn: (): Promise<TypePatternResponse> => pocketbase.collection('patterns').getOne(patternId, { expand: 'authors' }),
  });

export const useQueryGetPatternById = (patternId: string) => {
  return useQuery(getPatternByIdOptions(patternId));
};

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

export const useQueryGetAllPatternsForKeyMgmt = () => {
  return useQuery({
    queryKey: ['GetAllPatternsForKeyMgmt'],
    queryFn: async (): Promise<TypePatternResponse[]> => {
      return await pocketbase.collection('patterns').getFullList({
        filter: 'isDeleted = false && is_draft = false',
        sort: 'name',
        fields: 'id,name,pattern_key_reference_list',
      });
    },
  });
};
