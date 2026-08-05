import { useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';

// ─── Zero-result search analytics ──────────────────────────────────────────
//
// Every pattern search that matches nothing is logged server-side, inside the
// /api/pattern-search route (see pb_hooks/main.pb.js's logZeroResultSearch) -
// never from the client, so there's no public write path to spam.
// `search_logs` is the raw per-search log; `search_logs_by_query` is a
// PocketBase view collection that groups it by query text (see
// pb_schema.json). Both collections restrict List/View to admins.

export type TypeTopZeroResultSearch = {
  id: string;
  query: string;
  count: number;
  last_searched: string;
};

export const TOP_ZERO_RESULT_SEARCHES_QUERY_KEY = ['TopZeroResultSearches'] as const;

// Admin-only, ranked by how often each failing query has occurred. The view
// collection is always live (a plain GROUP BY/COUNT), so unlike the exports
// leaderboards there's no snapshot/cron step feeding this - it's queried
// straight from PocketBase, same as useQueryGetMonthlyTopExports.
export const useQueryGetTopZeroResultSearches = () => {
  return useQuery({
    queryKey: TOP_ZERO_RESULT_SEARCHES_QUERY_KEY,
    queryFn: async (): Promise<TypeTopZeroResultSearch[]> => {
      const result = await pocketbase
        .collection('search_logs_by_query')
        .getList<TypeTopZeroResultSearch>(1, 10, { sort: '-count' });
      return result.items;
    },
  });
};
