import { queryOptions, useMutation, useQuery } from '@tanstack/react-query';
import { pocketbase, pocketbaseDomain, queryClient } from '@/functions/database/authentication-setup';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TypeWikiCategory = {
  collectionId: string;
  collectionName: string;
  id: string;
  name: string;
  slug: string;
  order: number;
  created: Date;
  updated: Date;
};

export type TypeWikiPage = {
  collectionId: string;
  collectionName: string;
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string; // category record ID
  order: number;
  /** Optional calendar date to show on the page ("YYYY-MM-DD 00:00:00.000Z"). Empty when not set. */
  display_date?: string;
  created: Date;
  updated: Date;
  expand?: {
    category: TypeWikiCategory;
  };
};

// ─── Public wiki data ─────────────────────────────────────────────────────────

export type TypeWikiData = {
  categories: TypeWikiCategory[];
  /** Every page, with `category` expanded, sorted by category order, then page order, then title. */
  pages: TypeWikiPage[];
};

export const WIKI_DATA_QUERY_KEY = ['WikiData'] as const;

// Every category and page in one request (see pb_hooks/main.pb.js
// /api/wiki-data). All the public /wiki and /news routes read this one cached
// query - the index lists, the category lists, the single page view (see
// findWikiPage), and [[wiki-link]] resolution - so moving between wiki pages
// makes no new request. Shared between the route loaders (SSR) and
// useQueryGetWikiData so the key and fetcher can't drift apart.
export const getWikiDataOptions = () =>
  queryOptions({
    queryKey: WIKI_DATA_QUERY_KEY,
    queryFn: async (): Promise<TypeWikiData> => {
      const res = await fetch(`${pocketbaseDomain}/api/wiki-data`);
      if (!res.ok) throw new Error('Failed to load wiki');
      return res.json();
    },
  });

export const useQueryGetWikiData = () => {
  return useQuery(getWikiDataOptions());
};

export const findWikiPage = (pages: TypeWikiPage[], categorySlug: string, pageSlug: string) =>
  pages.find((p) => p.expand?.category?.slug === categorySlug && p.slug === pageSlug);

// The admin editor reads its own queries (useQueryGetAllWikiCategories/-Pages
// below), so every wiki mutation also marks the public WikiData query stale.
const invalidateWikiData = () => queryClient.invalidateQueries({ queryKey: WIKI_DATA_QUERY_KEY });

// ─── Category queries ─────────────────────────────────────────────────────────

export const useQueryGetAllWikiCategories = () => {
  return useQuery({
    queryKey: ['GetAllWikiCategories'],
    queryFn: async (): Promise<TypeWikiCategory[]> => {
      return await pocketbase.collection('wiki_categories').getFullList({
        sort: 'order,name',
      });
    },
  });
};

export type TypeWikiCategoryPayload = {
  id?: string;
  name: string;
  slug: string;
  order?: number;
};

export const useMutationCreateWikiCategory = () => {
  return useMutation({
    mutationFn: async (payload: TypeWikiCategoryPayload) => {
      await pocketbase.collection('wiki_categories').create(payload);
    },
    onSuccess: invalidateWikiData,
  });
};

export const useMutationUpdateWikiCategory = () => {
  return useMutation({
    mutationFn: async (payload: TypeWikiCategoryPayload) => {
      await pocketbase.collection('wiki_categories').update(payload.id ?? '', payload);
    },
    onSuccess: invalidateWikiData,
  });
};

export const useMutationDeleteWikiCategory = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      await pocketbase.collection('wiki_categories').delete(id);
    },
    onSuccess: invalidateWikiData,
  });
};

// ─── Page queries ─────────────────────────────────────────────────────────────

// Admin editor only - the public routes read useQueryGetWikiData above.
export const getAllWikiPagesOptions = () =>
  queryOptions({
    queryKey: ['GetAllWikiPages'],
    queryFn: (): Promise<TypeWikiPage[]> =>
      pocketbase.collection('wiki_pages').getFullList({
        expand: 'category',
        sort: 'category.order,order,title',
      }),
  });

export const useQueryGetAllWikiPages = () => {
  return useQuery(getAllWikiPagesOptions());
};

export type TypeWikiPagePayload = {
  id?: string;
  title: string;
  slug: string;
  content: string;
  category: string; // category record ID
  order?: number;
  display_date?: string; // "YYYY-MM-DD 00:00:00.000Z". An empty string clears the date.
};

export const useMutationCreateWikiPage = () => {
  return useMutation({
    mutationFn: async (payload: TypeWikiPagePayload) => {
      await pocketbase.collection('wiki_pages').create(payload);
    },
    onSuccess: invalidateWikiData,
  });
};

export const useMutationUpdateWikiPage = () => {
  return useMutation({
    mutationFn: async (payload: TypeWikiPagePayload) => {
      await pocketbase.collection('wiki_pages').update(payload.id ?? '', payload);
    },
    onSuccess: invalidateWikiData,
  });
};

export const useMutationDeleteWikiPage = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      await pocketbase.collection('wiki_pages').delete(id);
    },
    onSuccess: invalidateWikiData,
  });
};

export const useMutationReorderWikiCategories = () => {
  return useMutation({
    mutationFn: async (items: { id: string; order: number }[]) => {
      await Promise.all(
        items.map((item) => pocketbase.collection('wiki_categories').update(item.id, { order: item.order })),
      );
    },
    onSuccess: invalidateWikiData,
  });
};

export const useMutationReorderWikiPages = () => {
  return useMutation({
    mutationFn: async (items: { id: string; order: number }[]) => {
      await Promise.all(
        items.map((item) => pocketbase.collection('wiki_pages').update(item.id, { order: item.order })),
      );
    },
    onSuccess: invalidateWikiData,
  });
};
