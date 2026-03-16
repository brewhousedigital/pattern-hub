import { useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';

type TypeFAQItem = {
  collectionId: string;
  collectionName: string;
  id: string;
  title: string;
  content: string;
  created: Date;
  updated: Date;
};

export const useQueryGetAllFAQ = () => {
  return useQuery({
    queryKey: ['useQueryGetAllFAQ'],
    queryFn: async (): Promise<TypeFAQItem[]> => {
      return await pocketbase.collection('faq').getFullList({
        sort: 'title',
      });
    },
  });
};
