import { useMutation, useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import type { TypePatternResponse } from '@/functions/database/patterns';
import type { TypeAuthData } from '@/functions/database/authentication';

/** @deprecated - Uses Netlify functions instead  */
type TypeComplaintPayload = {
  pattern_id: string;
  reason: string;
  email: string;
  owner_id?: string;
};

/** @deprecated - Uses Netlify functions instead  */
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
    pattern_id: TypePatternResponse;
    owner_id: TypeAuthData;
    reviewed_by: TypeAuthData;
  };
};

export const useQueryGetComplaints = () => {
  return useQuery({
    queryKey: ['GetComplaints'],
    queryFn: async (): Promise<TypeComplaintsResponse[]> => {
      return await pocketbase.collection('complaints').getFullList({
        filter: `reviewed = false && pattern_id != ''`,
        sort: '-created',
        expand: 'pattern_id,owner_id',
      });
    },
  });
};

export const useQueryGetReviewedComplaintsByPagination = (searchTerm: string, pageNumber: number) => {
  return useQuery({
    queryKey: ['GetReviewedComplaintsByPagination', searchTerm, pageNumber],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypeComplaintsResponse>> => {
      let filter = `reviewed = true && spam = false && pattern_id != ''`;

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

// ─── Complaint resolution notifications (bell) ────────────────────────────────
// Backs the "report resolved" entries in NotificationBell.tsx. Rows are created
// server-side by the pb_hooks onRecordAfterUpdateSuccess hook on `complaints`
// (see pb_hooks/main.pb.js) when an admin marks a report reviewed - the client
// never creates these directly, only reads and dismisses (deletes) its own.
// Only reports filed while signed in (owner_id set) ever get one.
export type TypeComplaintNotificationResponse = {
  collectionId: string;
  collectionName: string;
  id: string;
  owner_id: string;
  complaint: string;
  reason?: string;
  created: string;
  updated: string;
  expand?: {
    complaint?: TypeComplaintsResponse;
  };
};

export const COMPLAINT_NOTIFICATIONS_QUERY_KEY = ['ComplaintNotifications'] as const;

export const useQueryGetComplaintNotifications = (userId: string) => {
  return useQuery({
    queryKey: [...COMPLAINT_NOTIFICATIONS_QUERY_KEY, userId],
    queryFn: async (): Promise<TypeComplaintNotificationResponse[]> => {
      return await pocketbase.collection('complaint_notifications').getFullList({
        filter: `owner_id = "${userId}"`,
        expand: 'complaint,complaint.pattern_id',
        sort: '-created',
      });
    },
    enabled: !!userId,
  });
};

// Dismissing a complaint notification deletes the row outright (unlike the
// collection/set follow notifications, which persist and just move their
// last_checked_updated marker) - this is a one-off event, not an ongoing
// subscription, so there's nothing left to track once it's been seen.
export const useMutationDismissComplaintNotification = () => {
  return useMutation({
    mutationFn: async (notificationId: string): Promise<void> => {
      await pocketbase.collection('complaint_notifications').delete(notificationId);
    },
  });
};
