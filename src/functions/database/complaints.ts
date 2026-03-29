import { useMutation, useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import type { TypePatternResponse } from '@/functions/database/patterns';
import type { TypeAuthData } from '@/functions/database/authentication';

type TypeComplaintPayload = {
  pattern_id: string;
  reason: string;
  email: string;
  owner_id?: string;
};

export const useMutationCreateComplaint = () => {
  return useMutation({
    mutationFn: async (payload: TypeComplaintPayload) => {
      await pocketbase.collection('complaints').create(payload);
    },
  });
};

export type TypeComplaintsResponse = {
  collectionId: string;
  collectionName: string;
  id: string;
  pattern_id: string;
  reason: string;
  owner_id: string;
  email: string;
  reviewed: boolean;
  spam: boolean;
  review_notes: string;
  reviewed_by: string;
  created: Date;
  updated: Date;
  expand: {
    pattern_id: TypePatternResponse;
    owner_id: TypeAuthData;
    reviewed_by: TypeAuthData;
  };
};

export const useQueryGetComplaints = () => {
  return useQuery({
    queryKey: ['useQueryGetComplaints'],
    queryFn: async (): Promise<TypeComplaintsResponse[]> => {
      return await pocketbase.collection('complaints').getFullList({
        filter: `reviewed = false`,
        sort: '-created',
        expand: 'pattern_id,owner_id',
      });
    },
  });
};

export const useQueryGetReviewedComplaintsByPagination = (searchTerm: string, pageNumber: number) => {
  return useQuery({
    queryKey: ['useQueryGetReviewedComplaintsByPagination', searchTerm, pageNumber],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypeComplaintsResponse>> => {
      let filter = `reviewed = true && spam = false`;

      if (searchTerm) {
        filter =
          filter +
          ` && (email ~ '${searchTerm}' || reason ~ '${searchTerm}' || pattern_id ~ '${searchTerm}' || review_notes ~ '${searchTerm}')`;
      }

      return await pocketbase.collection('complaints').getList(pageNumber, 25, {
        sort: '-updated',
        expand: 'owner_id,pattern_id,reviewed_by',
        filter: filter,
      });
    },
    enabled: !!pageNumber,
    refetchOnMount: 'always',
  });
};

export type TypeUpdateComplaintPayload = {
  id: string;
  reviewed: true;
  review_notes: string;
  reviewed_by: string;
  spam?: boolean;
};

export const useMutationUpdateComplaint = () => {
  return useMutation({
    mutationFn: async (payload: TypeUpdateComplaintPayload) => {
      await pocketbase.collection('complaints').update(payload.id, payload);
    },
  });
};
