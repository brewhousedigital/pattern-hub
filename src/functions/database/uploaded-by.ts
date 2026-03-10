import { useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypeReadOnlyDatabaseItem } from '@/functions/types/types';

export const useQueryGetAllUploadedBy = () => {
  return useQuery({
    queryKey: ['useQueryGetAllUploadedBy'],
    queryFn: async (): Promise<TypeReadOnlyDatabaseItem[]> => {
      return await pocketbase.collection('uploaded_by').getFullList();
    },
  });
};
