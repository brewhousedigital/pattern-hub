import { useMutation, useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';

export type TypeFAQItem = {
  collectionId: string;
  collectionName: string;
  id: string;
  title: string;
  content: string;
  order: number;
  created: Date;
  updated: Date;
};

export const useQueryGetAllFAQ = () => {
  return useQuery({
    queryKey: ['GetAllFAQ'],
    queryFn: async (): Promise<TypeFAQItem[]> => {
      return await pocketbase.collection('faq').getFullList({
        sort: 'order,title',
      });
    },
  });
};

export type TypeFAQPayload = {
  id?: string;
  title: string;
  content: string;
  order?: number;
};

export const useMutationCreateFAQ = () => {
  return useMutation({
    mutationFn: async (payload: TypeFAQPayload) => {
      await pocketbase.collection('faq').create(payload);
    },
  });
};

export const useMutationUpdateFAQ = () => {
  return useMutation({
    mutationFn: async (payload: TypeFAQPayload) => {
      await pocketbase.collection('faq').update(payload?.id || '', payload);
    },
  });
};

export const useMutationDeleteFAQ = () => {
  return useMutation({
    mutationFn: async (faq_id: string) => {
      await pocketbase.collection('faq').delete(faq_id);
    },
  });
};

export const useMutationReorderFAQItems = () => {
  return useMutation({
    mutationFn: async (items: { id: string; order: number }[]) => {
      await Promise.all(items.map((item) => pocketbase.collection('faq').update(item.id, { order: item.order })));
    },
  });
};
