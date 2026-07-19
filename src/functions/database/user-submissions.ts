import { useQuery, keepPreviousData, useMutation } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import type { TypePatternKeyReferenceObject, TypePatternLayersMapItem } from '@/functions/database/patterns';
import type { TypeAuthData } from '@/functions/database/authentication';

export type TypeUserSubmissionFileType = 'svg' | 'webp';
export type TypeUserSubmissionStatus = 'pending' | 'in_review' | 'published' | 'rejected';

export type TypeUserSubmittedPatternResponse = {
  collectionId: string;
  collectionName: string;
  id: string;
  submitter: string;
  is_author: boolean;
  author_manual_name?: string;
  source_url?: string;
  source_notes?: string;
  name: string;
  description: string;
  instructions?: string;
  pieces: number;
  design_width: number;
  design_height: number;
  line_width: number;
  design_width_unit: string;
  design_height_unit: string;
  line_width_unit: string;
  design_date?: string | null;
  tags: string[];
  pattern_key_reference_list: TypePatternKeyReferenceObject[];
  custom_pattern_key_requested: boolean;
  file_type: TypeUserSubmissionFileType;
  submitted_file: string;
  layers_map: TypePatternLayersMapItem[];
  has_layers: boolean;
  status: TypeUserSubmissionStatus;
  reviewing_admin?: string | null;
  review_started_at?: string | null;
  resulting_pattern?: string | null;
  admin_reupload_file?: string | null;
  hidden: boolean;
  created: string;
  updated: string;
  expand?: {
    submitter?: TypeAuthData;
    reviewing_admin?: TypeAuthData;
  };
};

// Admin moderation queue - hides published/rejected submissions once they've
// been actioned (record is kept, just dropped from the working list).
export const useQueryGetAllUserSubmissionsByPagination = (page: number, sort = '-created') => {
  return useQuery({
    queryKey: ['GetAllUserSubmissionsByPagination', page, sort],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypeUserSubmittedPatternResponse>> => {
      return await pocketbase.collection('user_submitted_patterns').getList(page, 25, {
        filter: 'hidden = false',
        expand: 'submitter,reviewing_admin',
        sort,
      });
    },
    enabled: !!page,
    placeholderData: keepPreviousData,
  });
};

export const useQueryGetUserSubmissionById = (id: string) => {
  return useQuery({
    queryKey: ['GetUserSubmissionById', id],
    queryFn: async (): Promise<TypeUserSubmittedPatternResponse> => {
      return await pocketbase.collection('user_submitted_patterns').getOne(id, { expand: 'submitter,reviewing_admin' });
    },
    enabled: !!id,
  });
};

export type TypeBeginReviewPayload = {
  id: string;
  adminId: string;
};

// Claims a submission for the current admin so no two admins work the same
// one in parallel - the reviewing_admin column surfaces this on the grid.
export const useMutationBeginReview = () => {
  return useMutation({
    mutationFn: async (payload: TypeBeginReviewPayload): Promise<TypeUserSubmittedPatternResponse> => {
      return await pocketbase.collection('user_submitted_patterns').update(payload.id, {
        status: 'in_review',
        reviewing_admin: payload.adminId,
        review_started_at: new Date().toISOString(),
      });
    },
  });
};

export const useMutationRejectUserSubmission = () => {
  return useMutation({
    mutationFn: async (id: string): Promise<TypeUserSubmittedPatternResponse> => {
      return await pocketbase.collection('user_submitted_patterns').update(id, {
        status: 'rejected',
        hidden: true,
      });
    },
  });
};

export type TypePublishUserSubmissionPayload = {
  id: string;
  resultingPatternId: string;
};

// Called after the reviewed content has already been written to `patterns` -
// this only marks the submission as consumed so it drops off the queue.
export const useMutationPublishUserSubmission = () => {
  return useMutation({
    mutationFn: async (payload: TypePublishUserSubmissionPayload): Promise<TypeUserSubmittedPatternResponse> => {
      return await pocketbase.collection('user_submitted_patterns').update(payload.id, {
        status: 'published',
        resulting_pattern: payload.resultingPatternId,
        hidden: true,
      });
    },
  });
};

export type TypeAdminReuploadPayload = {
  id: string;
  file: File;
  layersMap: TypePatternLayersMapItem[];
};

// Admin swaps a raster (webp) submission's working file for a hand-traced SVG.
// Writes to admin_reupload_file (not submitted_file) so the artist's original
// upload is never overwritten, and flips file_type/has_layers so the review
// UI re-enters the SVG code-review step for the new file.
export const useMutationAdminReuploadSvg = () => {
  return useMutation({
    mutationFn: async (payload: TypeAdminReuploadPayload): Promise<TypeUserSubmittedPatternResponse> => {
      const formData = new FormData();
      formData.append('admin_reupload_file', payload.file);
      formData.append('file_type', 'svg');
      formData.append('has_layers', String(payload.layersMap.length > 0));
      formData.append('layers_map', JSON.stringify(payload.layersMap));
      return await pocketbase.collection('user_submitted_patterns').update(payload.id, formData);
    },
  });
};
