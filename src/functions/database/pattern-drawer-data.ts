import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pocketbaseDomain } from '@/functions/database/authentication-setup';

export type TypeDrawerCommunityRating = {
  id: string;
  pattern_id: string;
  average_rating: number;
  total_ratings: number;
};

export type TypeDrawerUserRating = {
  id: string;
  pattern_id: string;
  owner_id: string;
  rating: number;
  rating_notes?: string;
};

export type TypeDrawerUserDifficulty = {
  id: string;
  pattern_id: string;
  owner_id: string;
  rating: number;
};

export type TypeDrawerUserRecord = {
  id: string;
  pattern_id: string;
  owner_id: string;
};

export type TypeDrawerSet = {
  id: string;
  title: string;
  description: string;
  color: string;
};

export type TypePatternDrawerData = {
  communityRating: TypeDrawerCommunityRating | null;
  communityDifficulty: TypeDrawerCommunityRating | null;
  userRating: TypeDrawerUserRating | null;
  userDifficulty: TypeDrawerUserDifficulty | null;
  userFavorite: TypeDrawerUserRecord | null;
  userMarkedDone: TypeDrawerUserRecord | null;
  sets: TypeDrawerSet[];
};

const drawerDataQueryKey = (patternId: string, userId: string) => ['DrawerData', patternId, userId] as const;

export const useQueryGetPatternDrawerData = (patternId: string, userId: string) => {
  return useQuery({
    queryKey: drawerDataQueryKey(patternId, userId),
    queryFn: async (): Promise<TypePatternDrawerData> => {
      const params = new URLSearchParams({ patternId });
      if (userId) params.set('userId', userId);
      const res = await fetch(`${pocketbaseDomain}/api/pattern-drawer-data?${params}`);
      if (!res.ok) throw new Error('Failed to load pattern data');
      return res.json();
    },
    enabled: !!patternId,
  });
};

export const useInvalidateDrawerData = (patternId: string, userId: string) => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: drawerDataQueryKey(patternId, userId) });
};
