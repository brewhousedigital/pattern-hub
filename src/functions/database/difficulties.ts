import { useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

export const useQueryGetAllDifficulties = () => {
  return useQuery({
    queryKey: ['useQueryGetAllDifficulties'],
    queryFn: async (): Promise<TypeReadOnlyDatabaseItem[]> => {
      return await pocketbase.collection('difficulties').getFullList();
    },
  });
};
