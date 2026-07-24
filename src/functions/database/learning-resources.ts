import { queryOptions, useMutation, useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import type { TypeResourceType } from '@/functions/utilities/resource-types';
import type { TypeResourceSortValue } from '@/functions/utilities/learning-resources-search';

export const LEARNING_RESOURCES_QUERY_KEY = ['LearningResources'] as const;

const PER_PAGE = 12;

export type TypeLearningResource = {
  id: string;
  title: string;
  description: string;
  url: string;
  resource_type: TypeResourceType;
  tags: string[];
  is_published: boolean;
  created: string;
  updated: string;
};

export type TypeLearningResourcePayload = {
  title: string;
  description?: string;
  url: string;
  resource_type: TypeResourceType;
  tags?: string[];
  is_published?: boolean;
};

// ─── Queries ───────────────────────────────────────────────────────────────────

/** Admin - every resource including drafts, sorted newest first. No relations
 * to expand, so this full-list result already has everything an edit dialog
 * needs - no separate getById fetch required. */
export const useQueryGetAllResources = () => {
  return useQuery({
    queryKey: [...LEARNING_RESOURCES_QUERY_KEY, 'all'],
    queryFn: async (): Promise<TypeLearningResource[]> =>
      pocketbase.collection('learning_resources').getFullList<TypeLearningResource>({ sort: '-created' }),
  });
};

export type TypeGetPublishedResourcesParams = {
  page: number;
  search: string;
  sort: TypeResourceSortValue;
};

/** Public - only published resources, paginated/searched/sorted. Shared between
 * the /learning-resources route loader (SSR) and useQueryGetPublishedResourcesPaginated
 * so the key and fetcher can't drift apart - same trick getPublishedSetsOptions uses. */
export const getPublishedResourcesOptions = (params: TypeGetPublishedResourcesParams) =>
  queryOptions({
    queryKey: [...LEARNING_RESOURCES_QUERY_KEY, 'published', params],
    // The PocketBase SDK's ListResult<T> shape ({page, perPage, totalItems,
    // totalPages, items}) already matches TypePaginationDatabaseResponse<T>
    // exactly, so this passes straight into PaginationBox with no mapping.
    queryFn: (): Promise<TypePaginationDatabaseResponse<TypeLearningResource>> => {
      const safeSearch = params.search.trim().replace(/"/g, '\\"');
      const filter =
        'is_published = true' +
        (safeSearch
          ? ` && (title ~ "${safeSearch}" || description ~ "${safeSearch}" || tags ~ "${safeSearch}")`
          : '');

      return pocketbase.collection('learning_resources').getList<TypeLearningResource>(params.page, PER_PAGE, {
        filter,
        sort: params.sort,
      });
    },
  });

export const useQueryGetPublishedResourcesPaginated = (params: TypeGetPublishedResourcesParams) => {
  return useQuery({
    ...getPublishedResourcesOptions(params),
    placeholderData: (prev) => prev,
  });
};

// ─── Mutations ─────────────────────────────────────────────────────────────────

export const useMutationCreateResource = () => {
  return useMutation({
    mutationFn: async (payload: TypeLearningResourcePayload): Promise<TypeLearningResource> =>
      pocketbase.collection('learning_resources').create<TypeLearningResource>(payload),
  });
};

export const useMutationUpdateResource = () => {
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<TypeLearningResourcePayload>;
    }): Promise<TypeLearningResource> =>
      pocketbase.collection('learning_resources').update<TypeLearningResource>(id, payload),
  });
};

export const useMutationDeleteResource = () => {
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await pocketbase.collection('learning_resources').delete(id);
    },
  });
};
