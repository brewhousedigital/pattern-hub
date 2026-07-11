import { useMutation, useQuery, queryOptions } from '@tanstack/react-query';
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

// Shared between the /help/faq route loader (SSR) and useQueryGetAllFAQ
// so the key and fetcher can't drift apart.
export const getAllFAQOptions = () =>
  queryOptions({
    queryKey: ['GetAllFAQ'],
    queryFn: (): Promise<TypeFAQItem[]> =>
      pocketbase.collection('faq').getFullList({
        sort: 'order,title',
      }),
  });

export const useQueryGetAllFAQ = () => {
  return useQuery(getAllFAQOptions());
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
