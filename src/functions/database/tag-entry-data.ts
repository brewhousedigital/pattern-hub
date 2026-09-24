import { useQuery } from '@tanstack/react-query';
import { pocketbaseDomain } from '@/functions/database/authentication-setup';
import type { TypeImpliedTagRecord, TypeTagAliasRecord } from '@/functions/database/tags';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

type TypeTagEntryDataResponse = {
  topTags: TypeReadOnlyDatabaseItem[];
  authorTagIds: string[];
  impliedTags: TypeImpliedTagRecord[];
  aliases: TypeTagAliasRecord[];
};

export type TypeTagEntryData = {
  /** Top 100 tags by usage (from the tag_usage view) - the default list before anything is typed. */
  topTags: TypeReadOnlyDatabaseItem[];
  /** Every Author-typed tags_v2 id - hidden from the tag picker. */
  authorTagIds: Set<string>;
  impliedTags: TypeImpliedTagRecord[];
  aliases: TypeTagAliasRecord[];
};

// Module-level so its reference is stable - React Query only re-runs `select`
// when the data or the function itself changes, so the Set keeps its identity
// between renders.
const selectTagEntryData = (data: TypeTagEntryDataResponse): TypeTagEntryData => ({
  // Defense-in-depth: ensure numeric-looking tags (e.g. "2007") are strings,
  // same as useQuerySearchTags.
  topTags: data.topTags.map((item) => ({ ...item, tag: String(item.tag) })),
  authorTagIds: new Set(data.authorTagIds),
  impliedTags: data.impliedTags,
  aliases: data.aliases,
});

// The reference data the public pattern submission form (UserUploadForm.tsx)
// needs before the user types anything, in one request (see
// pb_hooks/main.pb.js /api/tag-entry-data). Replaces four separate reads there:
// useQuerySearchTags(''), useQueryAuthorTagIds (which itself had to wait on
// useQueryGetAllTagTypes first), useQueryGetImpliedTags, and
// useQueryGetAllTagAliases. The search-as-you-type reads stay separate.
export const useQueryGetTagEntryData = () =>
  useQuery({
    queryKey: ['TagEntryData'],
    queryFn: async (): Promise<TypeTagEntryDataResponse> => {
      const res = await fetch(`${pocketbaseDomain}/api/tag-entry-data`);
      if (!res.ok) throw new Error('Failed to load tag data');
      return res.json();
    },
    select: selectTagEntryData,
  });
