import { useQuery, useMutation } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import { useGlobalAuthData } from '@/data/auth-data';

export type TypeDifficultyRatingPayload = {
  pattern_id: string;
  owner_id: string;
  rating: number;
  id?: string;
};

type TypeDifficultyRatingRecord = {
  id: string;
  pattern_id: string;
  owner_id: string;
  rating: number;
  created: string;
  updated: string;
};

type TypeCommunityDifficultyRatingItem = {
  collectionId: string;
  collectionName: string;
  id: string;
  pattern_id: string;
  average_rating: number;
  total_ratings: number;
};

export const useQueryGetPatternDifficultyRating = (pattern_id: string) => {
  return useQuery({
    queryKey: ['GetPatternDifficultyRating', pattern_id],
    queryFn: async (): Promise<TypeDifficultyRatingRecord> => {
      return await pocketbase
        .collection('user_difficulty_ratings')
        .getFirstListItem<TypeDifficultyRatingRecord>(`pattern_id="${pattern_id}"`);
    },
    enabled: !!pattern_id,
  });
};

export const useQueryGetCommunityDifficultyRatingByPatternId = (patternId: string) => {
  return useQuery({
    queryKey: ['GetCommunityDifficultyRating', patternId],
    queryFn: async (): Promise<TypeCommunityDifficultyRatingItem> => {
      return await pocketbase
        .collection('community_difficulty_ratings')
        .getFirstListItem<TypeCommunityDifficultyRatingItem>(`pattern_id="${patternId}"`);
    },
    enabled: !!patternId,
    refetchOnMount: 'always',
  });
};

export const useMutationCreatePatternDifficultyRating = () => {
  const { authData } = useGlobalAuthData();

  return useMutation({
    mutationFn: async (payload: TypeDifficultyRatingPayload) => {
      const data = { ...payload, owner_id: authData?.id || '' };
      await pocketbase.collection('user_difficulty_ratings').create(data);
    },
  });
};

export const useMutationUpdatePatternDifficultyRating = () => {
  const { authData } = useGlobalAuthData();

  return useMutation({
    mutationFn: async (payload: TypeDifficultyRatingPayload) => {
      const data = { ...payload, owner_id: authData?.id || '' };
      await pocketbase.collection('user_difficulty_ratings').update(payload.id || '', data);
    },
  });
};
