import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import { escapeTagFilterValue, type TypeTagV2Record } from '@/functions/database/tags';
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
  /**
   * The Author-type tags_v2 row this profile's flair (avatar, description,
   * external link) belongs to. Empty until an admin links it, or until the
   * one-time backfill links it automatically for a profile whose name
   * already matched an author found
   * in use. A profile can exist unlinked - it just isn't reachable from a
   * tag's Definition Page or from /authors/$slug until it is.
   */
  linked_tag: string;
  expand?: { linked_tag?: TypeTagV2Record };
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
  });

// expand: 'linked_tag' - the /authors/$slug loader reads
// author.expand?.linked_tag?.linked_user to
// decide whether to redirect to the linked account's real profile, in one
// request instead of two.
export const useQueryGetManualAuthorBySlug = (slug: string) =>
  useQuery({
    queryKey: ['ManualAuthorBySlug', slug],
    queryFn: () =>
      pocketbase
        .collection('manual_authors')
        .getFirstListItem<TypeManualAuthor>(`slug = '${slug}' && is_published = true`, { expand: 'linked_tag' }),
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
        .getFirstListItem<TypeManualAuthor>(`slug = '${slug}' && is_published = true`, { expand: 'linked_tag' }),
    retry: false,
  });

// Replaces the old useQueryGetPatternsByManualAuthorName, which
// matched author_manual with an unquoted substring filter - "Jo" matched
// "Joanna". This matches tags with the same boundary-quoted, exact match
// every other tag search in this codebase already uses, so that class of
// bug cannot happen here either. Pass the author's linked tag name when one
// exists, falling back to their plain (normalized) name otherwise - see
// /authors/$slug.tsx, which does exactly that fallback. Works the same for
// a registered or a manual author; nothing about this query is
// manual-author-specific anymore.
export const useQueryGetPatternsByAuthorTag = (tagName: string, page: number) =>
  useQuery({
    queryKey: ['PatternsByAuthorTag', tagName, page],
    queryFn: () =>
      pocketbase.collection('patterns').getList<TypePatternResponse>(page, 12, {
        filter: `tags ~ '"${escapeTagFilterValue(tagName)}"' && isDeleted = false && is_draft = false`,
        sort: '-created',
      }),
    enabled: !!tagName,
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
