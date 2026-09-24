import { queryOptions, useQuery } from '@tanstack/react-query';
import { pocketbase, pocketbaseDomain } from '@/functions/database/authentication-setup';
import type { TypeFollowedCollectionResponse } from '@/functions/database/collections';
import type { TypeFollowedSetResponse } from '@/functions/database/sets';
import type { TypeUserSubmissionNotificationResponse } from '@/functions/database/user-submissions';
import type { TypeComplaintNotificationResponse } from '@/functions/database/complaints';

export type TypeUserNotificationsResponse = {
  followedCollections: TypeFollowedCollectionResponse[];
  followedSets: TypeFollowedSetResponse[];
  submissionNotifications: TypeUserSubmissionNotificationResponse[];
  complaintNotifications: TypeComplaintNotificationResponse[];
};

export const USER_NOTIFICATIONS_QUERY_KEY = ['UserNotifications'] as const;

// One call for everything NotificationBell shows (see pb_hooks/main.pb.js
// /api/user-notifications). The server reads the user from the auth token -
// userId is only in the key so that each signed-in user gets a separate
// cache entry. useQueryGetUserFollowedSets/-Collections are `select` views of
// this same query, so the set and collection pages share this one request.
export const getUserNotificationsOptions = (userId: string) =>
  queryOptions({
    queryKey: [...USER_NOTIFICATIONS_QUERY_KEY, userId],
    queryFn: async (): Promise<TypeUserNotificationsResponse> => {
      const res = await fetch(`${pocketbaseDomain}/api/user-notifications`, {
        headers: { Authorization: pocketbase.authStore.token },
      });
      if (!res.ok) throw new Error('Failed to load notifications');
      return res.json();
    },
    enabled: !!userId,
  });

export const useQueryGetUserNotifications = (userId: string) => {
  return useQuery(getUserNotificationsOptions(userId));
};
