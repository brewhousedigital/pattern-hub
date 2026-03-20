import { useQuery, useMutation } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import { useGlobalAuthData } from '@/data/auth-data';
import type { TypeFavoriteDoneRatingsResponse } from '@/functions/types/types';

export const useQueryGetUserMarkedDoneByPagination = (pageNumber: number) => {
  return useQuery({
    queryKey: ['useQueryGetUserMarkedDoneByPagination', pageNumber],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypeFavoriteDoneRatingsResponse>> => {
      return await pocketbase.collection('user_marked_done').getList(pageNumber, 25, {
        sort: '-created',
        expand: 'pattern_id',
      });
    },
    enabled: !!pageNumber,
  });
};

export const useQueryGetPatternDoneStatus = (pattern_id: string) => {
  return useQuery({
    queryKey: ['useQueryGetPatternDoneStatus', pattern_id],
    queryFn: async (): Promise<TypeFavoriteDoneRatingsResponse> => {
      return await pocketbase.collection('user_marked_done').getFirstListItem(`pattern_id="${pattern_id}"`);
    },
    enabled: !!pattern_id,
  });
};

export const useMutationMarkDonePattern = () => {
  const { authData } = useGlobalAuthData();

  return useMutation({
    mutationFn: async (pattern_id: string) => {
      const data = {
        pattern_id: pattern_id,
        owner_id: authData?.id,
      };

      await pocketbase.collection('user_marked_done').create(data);
    },
  });
};

export const useMutationRemoveMarkDonePattern = () => {
  return useMutation({
    mutationFn: async (pattern_id: string) => {
      await pocketbase.collection('user_marked_done').delete(pattern_id);
    },
  });
};
