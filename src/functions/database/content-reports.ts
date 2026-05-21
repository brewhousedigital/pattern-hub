import { useMutation, useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import type { TypeAuthData } from '@/functions/database/authentication';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Canonical content types for the content_reports collection. */
export type TypeContentReportType = 'store' | 'wiki' | 'faq' | 'other';

export type TypeContentReportResponse = {
  collectionId: string;
  collectionName: string;
  id: string;
  /** Which area of the site the report relates to. */
  content_type: TypeContentReportType;
  /** The PocketBase ID of the reported item. */
  content_id: string;
  /** Human-readable name of the reported item (e.g. store name, article title). */
  content_name: string;
  reason: string;
  category: string;
  owner_id: string;
  email: string;
  reviewed: boolean;
  spam: boolean;
  review_notes: string;
  reviewed_by: string;
  created: Date;
  updated: Date;
  expand: {
    owner_id?: TypeAuthData;
    reviewed_by?: TypeAuthData;
  };
};

// ─── Display helpers ──────────────────────────────────────────────────────────

export const CONTENT_TYPE_META: Record<
  TypeContentReportType | string,
  { label: string; color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' }
> = {
  store: { label: 'Store Locator', color: 'info' },
  wiki: { label: 'Wiki', color: 'secondary' },
  faq: { label: 'FAQ', color: 'primary' },
  other: { label: 'Other', color: 'default' },
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export const useQueryGetContentReports = (contentType?: TypeContentReportType) => {
  return useQuery({
    queryKey: ['GetContentReports', contentType ?? 'all'],
    queryFn: async (): Promise<TypeContentReportResponse[]> => {
      let filter = 'reviewed = false';
      if (contentType) filter += ` && content_type = '${contentType}'`;

      return await pocketbase.collection('content_reports').getFullList({
        filter,
        sort: '-created',
        expand: 'owner_id',
      });
    },
  });
};

export const useQueryGetReviewedContentReportsByPagination = (
  searchTerm: string,
  pageNumber: number,
  contentType?: TypeContentReportType,
) => {
  return useQuery({
    queryKey: ['GetReviewedContentReportsByPagination', searchTerm, pageNumber, contentType ?? 'all'],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypeContentReportResponse>> => {
      let filter = 'reviewed = true && spam = false';
      if (contentType) filter += ` && content_type = '${contentType}'`;

      if (searchTerm) {
        filter +=
          ` && (email ~ '${searchTerm}' || reason ~ '${searchTerm}' || content_id ~ '${searchTerm}'` +
          ` || content_name ~ '${searchTerm}' || review_notes ~ '${searchTerm}')`;
      }

      return await pocketbase.collection('content_reports').getList(pageNumber, 25, {
        sort: '-updated',
        expand: 'owner_id,reviewed_by',
        filter,
      });
    },
    enabled: !!pageNumber,
    refetchOnMount: 'always',
  });
};

// ─── Mutations ────────────────────────────────────────────────────────────────

export type TypeUpdateContentReportPayload = {
  id: string;
  reviewed: true;
  review_notes: string;
  reviewed_by: string;
  spam?: boolean;
};

export const useMutationUpdateContentReport = () => {
  return useMutation({
    mutationFn: async (payload: TypeUpdateContentReportPayload) => {
      await pocketbase.collection('content_reports').update(payload.id, payload);
    },
  });
};
