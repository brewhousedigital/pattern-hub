import { queryOptions, useQuery } from '@tanstack/react-query';
import { pocketbaseDomain } from '@/functions/database/authentication-setup';
import type { TypeImpliedTagRecord, TypeTagAliasRecord, TypeTagV2Record } from '@/functions/database/tags';

export type TypeTagPageData = {
  /** The tags_v2 row, with `type` expanded. */
  tag: TypeTagV2Record;
  /** Published, non-deleted patterns that carry this tag. */
  usageCount: number;
  /** Direct "implies" edges only - not the full transitive closure. */
  implies: TypeImpliedTagRecord[];
  /** Direct edges where another tag implies this one. */
  impliedBy: TypeImpliedTagRecord[];
  aliases: TypeTagAliasRecord[];
};

// Everything the /tags/$slug Definition Page shows, in one request (see
// pb_hooks/main.pb.js /api/tag-page-data). Shared between the route loader
// (SSR) and useQueryGetTagPageData so the key and fetcher can't drift apart.
//
// Matches either the current slug, or a past one filed in `previous_slugs`
// after a rename - the caller compares the returned tag's own `slug` against
// the requested one to detect that case and redirect to the canonical URL.
export const getTagPageDataOptions = (slug: string) =>
  queryOptions({
    queryKey: ['TagPageData', slug],
    queryFn: async (): Promise<TypeTagPageData> => {
      const res = await fetch(`${pocketbaseDomain}/api/tag-page-data?${new URLSearchParams({ slug })}`);
      if (!res.ok) throw new Error('Failed to load tag');
      return res.json();
    },
    retry: false,
  });

export const useQueryGetTagPageData = (slug: string) =>
  useQuery({
    ...getTagPageDataOptions(slug),
    enabled: !!slug,
  });
