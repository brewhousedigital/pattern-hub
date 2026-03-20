import { useQuery, useMutation } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';

type TypeExtraUserDataResponse = {
  collectionId: string;
  collectionName: string;
  id: string;
  favorite: boolean;
  marked_done: boolean;
  rating: number;
  rating_notes: string;
  owner_id: string;
  pattern_id: string;
  created: Date;
  updated: Date;
};

export const useQueryGetExtraUserDataByPagination = (pageNumber: number) => {
  return useQuery({
    queryKey: ['useQueryGetExtraUserDataByPagination', pageNumber],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypeExtraUserDataResponse>> => {
      return await pocketbase.collection('extra_user_data').getList(pageNumber, 25, {
        sort: '-created',
      });
    },
    enabled: !!pageNumber,
  });
};

export const useMutationFavoritePattern = () => {
  return useMutation({
    mutationFn: async(payload: any) => {
      
    }
  })
}
