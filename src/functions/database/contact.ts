import { useMutation, useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import type { TypeAuthData } from '@/functions/database/authentication';

// ─── Types ────────────────────────────────────────────────────────────────────

type TypeContactPayload = {
  name: string;
  email: string;
  message: string;
};

export type TypeContactResponse = {
  collectionId: string;
  collectionName: string;
  id: string;
  name: string;
  email: string;
  message: string;
  reviewed: boolean;
  review_notes: string;
  reviewed_by: string;
  created: Date;
  updated: Date;
  expand: {
    reviewed_by: TypeAuthData;
  };
};

export type TypeUpdateContactPayload = {
  id: string;
  reviewed: true;
  review_notes: string;
  reviewed_by: string;
};

// ─── Mutations ────────────────────────────────────────────────────────────────

export const useMutationCreateContactSubmission = () => {
  return useMutation({
    mutationFn: async (payload: TypeContactPayload) => {
      await pocketbase.collection('contact_submissions').create(payload);
    },
  });
};

export const useMutationUpdateContactSubmission = () => {
  return useMutation({
    mutationFn: async (payload: TypeUpdateContactPayload) => {
      await pocketbase.collection('contact_submissions').update(payload.id, payload);
    },
  });
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export const useQueryGetPendingContactSubmissions = () => {
  return useQuery({
    queryKey: ['GetPendingContactSubmissions'],
    queryFn: async (): Promise<TypeContactResponse[]> => {
      return await pocketbase.collection('contact_submissions').getFullList({
        filter: `reviewed = false`,
        sort: '-created',
      });
    },
  });
};

export const useQueryGetReviewedContactSubmissionsByPagination = (searchTerm: string, pageNumber: number) => {
  return useQuery({
    queryKey: ['GetReviewedContactSubmissionsByPagination', searchTerm, pageNumber],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypeContactResponse>> => {
      let filter = `reviewed = true`;

      if (searchTerm) {
        filter =
          filter +
          ` && (name ~ '${searchTerm}' || email ~ '${searchTerm}' || message ~ '${searchTerm}' || review_notes ~ '${searchTerm}')`;
      }

      return await pocketbase.collection('contact_submissions').getList(pageNumber, 25, {
        sort: '-updated',
        expand: 'reviewed_by',
        filter: filter,
      });
    },
    enabled: !!pageNumber,
  });
};
