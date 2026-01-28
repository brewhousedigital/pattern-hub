import { useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

export const useQueryGetAllTags = () => {
  return useQuery({
    queryKey: ['useQueryGetAllTags'],
    queryFn: async (): Promise<TypeReadOnlyDatabaseItem[]> => {
      return await pocketbase.collection('tags').getFullList();
    },
  });
};
