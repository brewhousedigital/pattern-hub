import { useQuery, useMutation } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import { useGlobalAuthData } from '@/data/auth-data';
import type { TypeFavoriteDoneRatingsResponse } from '@/functions/types/types';

export const useQueryGetUserRatingsByPagination = (pageNumber: number) => {
  return useQuery({
    queryKey: ['useQueryGetUserRatingsByPagination', pageNumber],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypeFavoriteDoneRatingsResponse>> => {
      return await pocketbase.collection('user_ratings').getList(pageNumber, 25, {
        sort: '-created',
        expand: 'pattern_id',
      });
    },
    enabled: !!pageNumber,
  });
};

export const useQueryGetPatternRating = (pattern_id: string) => {
  return useQuery({
    queryKey: ['useQueryGetPatternRating', pattern_id],
    queryFn: async (): Promise<TypeFavoriteDoneRatingsResponse> => {
      return await pocketbase.collection('user_ratings').getFirstListItem(`pattern_id="${pattern_id}"`);
    },
    enabled: !!pattern_id,
  });
};

export type TypeRatingPayload = {
  pattern_id: string;
  owner_id: string;
  rating: number;
  rating_notes: string;
  id?: string;
};

export const useMutationCreatePatternRating = () => {
  const { authData } = useGlobalAuthData();

  return useMutation({
    mutationFn: async (payload: TypeRatingPayload) => {
      const data: TypeRatingPayload = JSON.parse(JSON.stringify(payload));
      data.owner_id = authData?.id || '';

      await pocketbase.collection('user_ratings').create(data);
    },
  });
};

export const useMutationUpdatePatternRating = () => {
  const { authData } = useGlobalAuthData();

  return useMutation({
    mutationFn: async (payload: TypeRatingPayload) => {
      const data: TypeRatingPayload = JSON.parse(JSON.stringify(payload));
      data.owner_id = authData?.id || '';

      await pocketbase.collection('user_ratings').update(payload.id || '', data);
    },
  });
};

export const useMutationRemovePatternRating = () => {
  return useMutation({
    mutationFn: async (pattern_id: string) => {
      await pocketbase.collection('user_ratings').delete(pattern_id);
    },
  });
};
