import { useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

export const useQueryGetAllAuthors = () => {
  return useQuery({
    queryKey: ['useQueryGetAllAuthors'],
    queryFn: async (): Promise<TypeReadOnlyDatabaseItem[]> => {
      return await pocketbase.collection('authors').getFullList();
    },
  });
};
