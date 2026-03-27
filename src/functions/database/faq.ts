import { useMutation, useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';

export type TypeFAQItem = {
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

export type TypeFAQPayload = {
  id?: string;
  title: string;
  content: string;
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
