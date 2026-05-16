import { useMutation, useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';

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
  created: Date;
  updated: Date;
  expand?: {
    category: TypeWikiCategory;
  };
};

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
  });
};

export const useMutationUpdateWikiCategory = () => {
  return useMutation({
    mutationFn: async (payload: TypeWikiCategoryPayload) => {
      await pocketbase.collection('wiki_categories').update(payload.id ?? '', payload);
    },
  });
};

export const useMutationDeleteWikiCategory = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      await pocketbase.collection('wiki_categories').delete(id);
    },
  });
};

// ─── Page queries ─────────────────────────────────────────────────────────────

export const useQueryGetAllWikiPages = () => {
  return useQuery({
    queryKey: ['GetAllWikiPages'],
    queryFn: async (): Promise<TypeWikiPage[]> => {
      return await pocketbase.collection('wiki_pages').getFullList({
        expand: 'category',
        sort: 'category.order,order,title',
      });
    },
  });
};

export const useQueryGetWikiPage = (categorySlug: string, pageSlug: string) => {
  return useQuery({
    queryKey: ['GetWikiPage', categorySlug, pageSlug],
    queryFn: async (): Promise<TypeWikiPage> => {
      return await pocketbase
        .collection('wiki_pages')
        .getFirstListItem(`category.slug="${categorySlug}" && slug="${pageSlug}"`, {
          expand: 'category',
        });
    },
    enabled: !!categorySlug && !!pageSlug,
  });
};

export type TypeWikiPagePayload = {
  id?: string;
  title: string;
  slug: string;
  content: string;
  category: string; // category record ID
  order?: number;
};

export const useMutationCreateWikiPage = () => {
  return useMutation({
    mutationFn: async (payload: TypeWikiPagePayload) => {
      await pocketbase.collection('wiki_pages').create(payload);
    },
  });
};

export const useMutationUpdateWikiPage = () => {
  return useMutation({
    mutationFn: async (payload: TypeWikiPagePayload) => {
      await pocketbase.collection('wiki_pages').update(payload.id ?? '', payload);
    },
  });
};

export const useMutationDeleteWikiPage = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      await pocketbase.collection('wiki_pages').delete(id);
    },
  });
};
