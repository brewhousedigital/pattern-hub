import { useQuery } from '@tanstack/react-query';
import { pocketbaseDomain } from '@/functions/database/authentication-setup';
import { useAuthorizationHeaders } from '@/functions/database/useAuthorizationHeaders';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

// Consolidates the 4 sidebar-badge lookups AdminLayout fires on every single
// space-command page into one request instead of 4.
export type TypeAdminNavBadges = {
  complaints: number;
  contentReports: number;
  contactSubmissions: number;
  userSubmissions: number;
};

export const useQueryGetAdminNavBadges = () => {
  const authHeaders = useAuthorizationHeaders('GET');
  return useQuery({
    queryKey: ['AdminNavBadges'],
    queryFn: async (): Promise<TypeAdminNavBadges> => {
      const res = await fetch(`${pocketbaseDomain}/api/admin-nav-badges`, authHeaders);
      if (!res.ok) throw new Error('Failed to load admin nav badges');
      return res.json();
    },
  });
};

// Consolidates the 8 space-command dashboard summary cards + the authors
// table into one request instead of 9.
export type TypeSpaceCommandDashboardData = {
  users: { totalItems: number; newestCreated: string | null };
  patterns: { totalItems: number; newestCreated: string | null };
  tags: { totalItems: number; topTag: { tag: string; count: number } | null };
  complaints: { totalItems: number; latestCreated: string | null };
  faq: { totalItems: number; lastUpdated: string | null };
  wiki: { categoryCount: number; pageCount: number; lastUpdated: string | null };
  storeLocations: { totalItems: number };
  sets: { totalItems: number; published: number; draft: number };
  authors: TypeReadOnlyDatabaseItem[];
};

export const useQueryGetSpaceCommandDashboardData = () => {
  const authHeaders = useAuthorizationHeaders('GET');
  return useQuery({
    queryKey: ['SpaceCommandDashboardData'],
    queryFn: async (): Promise<TypeSpaceCommandDashboardData> => {
      const res = await fetch(`${pocketbaseDomain}/api/space-command-dashboard`, authHeaders);
      if (!res.ok) throw new Error('Failed to load dashboard data');
      return res.json();
    },
  });
};
