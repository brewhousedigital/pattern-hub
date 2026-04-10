import { useQuery, useMutation } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import { useGlobalAuthData } from '@/data/auth-data';
import type { TypeFavoriteDoneRatingsResponse } from '@/functions/types/types';

export const useQueryGetUserFavoritesByPagination = (userId: string, pageNumber: number) => {
  return useQuery({
    queryKey: ['useQueryGetFavoritesDataByPagination', userId, pageNumber],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypeFavoriteDoneRatingsResponse>> => {
      return await pocketbase.collection('user_favorites').getList(pageNumber, 25, {
        sort: '-created',
        expand: 'pattern_id',
        filter: `owner_id = "${userId}" && pattern_id != ''`,
      });
    },
    enabled: !!pageNumber && !!userId,
    refetchOnMount: 'always',
  });
};

export const useQueryGetPatternFavoriteStatus = (pattern_id: string) => {
  return useQuery({
    queryKey: ['useQueryGetPatternFavoriteStatus', pattern_id],
    queryFn: async (): Promise<TypeFavoriteDoneRatingsResponse> => {
      return await pocketbase.collection('user_favorites').getFirstListItem(`pattern_id="${pattern_id}"`);
    },
    enabled: !!pattern_id,
  });
};

export const useMutationFavoritePattern = () => {
  const { authData } = useGlobalAuthData();

  return useMutation({
    mutationFn: async (pattern_id: string) => {
      const data = {
        pattern_id: pattern_id,
        owner_id: authData?.id,
      };

      await pocketbase.collection('user_favorites').create(data);
    },
  });
};

export const useMutationRemoveFavoritePattern = () => {
  return useMutation({
    mutationFn: async (pattern_id: string) => {
      await pocketbase.collection('user_favorites').delete(pattern_id);
    },
  });
};
