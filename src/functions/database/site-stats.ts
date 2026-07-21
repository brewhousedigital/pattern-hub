import { useQuery } from '@tanstack/react-query';
import { pocketbaseDomain } from '@/functions/database/authentication-setup';

export type TypePublicSiteStats = {
  patterns: number;
  members: number;
  tags: number;
};

// Public, unauthenticated aggregate counts (see pb_hooks/main.pb.js
// /api/public-site-stats) - used by the /community page's stats strip.
export const useQueryGetPublicSiteStats = () => {
  return useQuery({
    queryKey: ['PublicSiteStats'],
    queryFn: async (): Promise<TypePublicSiteStats> => {
      const res = await fetch(`${pocketbaseDomain}/api/public-site-stats`);
      if (!res.ok) throw new Error('Failed to load site stats');
      return res.json();
    },
  });
};
