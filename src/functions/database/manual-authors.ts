import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePatternResponse } from '@/functions/database/patterns';

export const MANUAL_AUTHORS_QUERY_KEY = ['ManualAuthors'] as const;
export const PUBLISHED_MANUAL_AUTHORS_QUERY_KEY = ['PublishedManualAuthors'] as const;

export type TypeManualAuthor = {
  id: string;
  collectionId: string;
  name: string;
  slug: string;
  avatar: string;
  description: string;
  external_url: string;
  is_published: boolean;
  created: string;
  updated: string;
};

export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const useQueryGetAllManualAuthors = () =>
  useQuery({
    queryKey: MANUAL_AUTHORS_QUERY_KEY,
    queryFn: () => pocketbase.collection('manual_authors').getFullList<TypeManualAuthor>({ sort: 'name' }),
  });

export const useQueryGetPublishedManualAuthors = () =>
  useQuery({
    queryKey: PUBLISHED_MANUAL_AUTHORS_QUERY_KEY,
    queryFn: () =>
      pocketbase.collection('manual_authors').getFullList<TypeManualAuthor>({
        filter: 'is_published = true',
        fields: 'id,name,slug,collectionId,avatar',
      }),
    staleTime: 5 * 60 * 1000,
  });

export const useQueryGetManualAuthorBySlug = (slug: string) =>
  useQuery({
    queryKey: ['ManualAuthorBySlug', slug],
    queryFn: () =>
      pocketbase
        .collection('manual_authors')
        .getFirstListItem<TypeManualAuthor>(`slug = '${slug}' && is_published = true`),
    enabled: !!slug,
    retry: false,
  });

// This is a fancy thing to handle automate queries for data on dynamic pages
export const getManualAuthorBySlugOptions = (slug: string) =>
  queryOptions({
    queryKey: ['ManualAuthorBySlug', slug],
    queryFn: () =>
      pocketbase
        .collection('manual_authors')
        .getFirstListItem<TypeManualAuthor>(`slug = '${slug}' && is_published = true`),
    retry: false,
  });

export const useQueryGetPatternsByManualAuthorName = (name: string, page: number) =>
  useQuery({
    queryKey: ['PatternsByManualAuthor', name, page],
    queryFn: () =>
      pocketbase.collection('patterns').getList<TypePatternResponse>(page, 12, {
        filter: `author_manual ~ '${name.replace(/'/g, "\\'")}' && isDeleted = false && is_draft = false`,
        sort: '-created',
      }),
    enabled: !!name,
    placeholderData: keepPreviousData,
  });

export const useMutationCreateManualAuthor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      pocketbase.collection('manual_authors').create<TypeManualAuthor>(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MANUAL_AUTHORS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLISHED_MANUAL_AUTHORS_QUERY_KEY });
    },
  });
};

export const useMutationUpdateManualAuthor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, formData }: { id: string; formData: FormData }) =>
      pocketbase.collection('manual_authors').update<TypeManualAuthor>(id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MANUAL_AUTHORS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLISHED_MANUAL_AUTHORS_QUERY_KEY });
    },
  });
};

export const useMutationDeleteManualAuthor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pocketbase.collection('manual_authors').delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MANUAL_AUTHORS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: PUBLISHED_MANUAL_AUTHORS_QUERY_KEY });
    },
  });
};
