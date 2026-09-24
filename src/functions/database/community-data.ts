import { useQuery } from '@tanstack/react-query';
import { pocketbaseDomain } from '@/functions/database/authentication-setup';
import type { TypePublicDatabaseStatsSnapshot } from '@/functions/database/database-stats';

export type TypePublicSiteStats = {
  patterns: number;
  members: number;
  tags: number;
};

export type TypeCommunityData = {
  /** Current totals for the stats strip. */
  stats: TypePublicSiteStats;
  /** Every daily snapshot, oldest first, for the growth charts. */
  history: TypePublicDatabaseStatsSnapshot[];
};

export const COMMUNITY_DATA_QUERY_KEY = ['CommunityData'] as const;

// Public, unauthenticated. The /community page's stats strip and growth-chart
// history in one request (see pb_hooks/main.pb.js /api/community-data).
export const useQueryGetCommunityData = () => {
  return useQuery({
    queryKey: COMMUNITY_DATA_QUERY_KEY,
    queryFn: async (): Promise<TypeCommunityData> => {
      const res = await fetch(`${pocketbaseDomain}/api/community-data`);
      if (!res.ok) throw new Error('Failed to load community data');
      return res.json();
    },
  });
};
