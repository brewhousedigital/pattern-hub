import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { pocketbaseDomain } from '@/functions/database/authentication-setup';
import type { TypeManualAuthor } from '@/functions/database/manual-authors';
import type { TypePatternResponse } from '@/functions/database/patterns';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';

export type TypeAuthorPageData = {
  /** The published manual_authors row, with `linked_tag` expanded. */
  author: TypeManualAuthor;
  /** One page (12 per page) of this author's published patterns, newest first. */
  patterns: TypePaginationDatabaseResponse<TypePatternResponse>;
};

// The author profile and one page of their patterns in one request (see
// pb_hooks/main.pb.js /api/author-page-data). Shared between the
// /authors/$slug loader (SSR, page 1) and useQueryGetAuthorPageData so the key
// and fetcher can't drift apart.
//
// The server matches patterns on the author's tags_v2 id in tag_refs - the
// linked Author tag when there is one, else the tag with the author's
// normalized name. It does not use the frozen legacy `tags` string column.
export const getAuthorPageDataOptions = (slug: string, page: number) =>
  queryOptions({
    queryKey: ['AuthorPageData', slug, page],
    queryFn: async (): Promise<TypeAuthorPageData> => {
      const params = new URLSearchParams({ slug, page: String(page) });
      const res = await fetch(`${pocketbaseDomain}/api/author-page-data?${params}`);
      if (!res.ok) throw new Error('Failed to load author');
      return res.json();
    },
    retry: false,
  });

export const useQueryGetAuthorPageData = (slug: string, page: number) =>
  useQuery({
    ...getAuthorPageDataOptions(slug, page),
    enabled: !!slug,
    placeholderData: keepPreviousData,
  });
