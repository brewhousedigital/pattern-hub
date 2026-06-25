import { useMutation, useQuery } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import { useGlobalAuthData } from '@/data/auth-data';
import type { TypePatternResponse } from '@/functions/database/patterns';

export const PATTERN_SETS_QUERY_KEY = ['PatternSets'] as const;
export const FOLLOWED_SETS_QUERY_KEY = ['FollowedSets'] as const;

export type TypePatternSet = {
  id: string;
  title: string;
  description: string;
  patterns: string[];
  position: number;
  is_published: boolean;
  color: string;
  created: string;
  updated: string;
  expand?: {
    patterns?: TypePatternResponse[];
  };
};

export type TypeFollowedSetResponse = {
  id: string;
  owner_id: string;
  set_id: string;
  last_checked_updated: string;
  created: string;
  updated: string;
  expand?: { set_id?: TypePatternSet };
};

export type TypePatternSetPayload = {
  title: string;
  description?: string;
  patterns?: string[];
  position?: number;
  is_published?: boolean;
  color?: string;
};

// ─── Queries ───────────────────────────────────────────────────────────────────

/** Admin - all sets including unpublished, sorted by position then title. */
export const useQueryGetAllSets = () => {
  return useQuery({
    queryKey: [...PATTERN_SETS_QUERY_KEY, 'all'],
    queryFn: async (): Promise<TypePatternSet[]> =>
      pocketbase.collection('pattern_sets').getFullList<TypePatternSet>({ sort: 'position,title' }),
  });
};

/** Public - only published sets, sorted by position then title. */
export const useQueryGetPublishedSets = () => {
  return useQuery({
    queryKey: [...PATTERN_SETS_QUERY_KEY, 'published'],
    queryFn: async (): Promise<TypePatternSet[]> =>
      pocketbase.collection('pattern_sets').getFullList<TypePatternSet>({
        filter: 'is_published = true',
        sort: 'position,title',
      }),
  });
};

/** Single set with all patterns and their authors expanded. */
export const useQueryGetSetById = (id?: string) => {
  return useQuery({
    queryKey: [...PATTERN_SETS_QUERY_KEY, id],
    queryFn: async (): Promise<TypePatternSet> =>
      pocketbase.collection('pattern_sets').getOne<TypePatternSet>(id!, {
        expand: 'patterns,patterns.authors',
        sort: '-created',
      }),
    enabled: !!id,
  });
};

/** Pattern search for the admin pattern picker - max 20 results. */
export const useQuerySearchPatternsForPicker = (search: string) => {
  return useQuery({
    queryKey: ['PatternPickerSearch', search],
    queryFn: async (): Promise<TypePatternResponse[]> => {
      const safe = search.trim().replace(/"/g, '\\"');
      const filter = safe
        ? `isDeleted=false && is_draft=false && (name~"${safe}" || description~"${safe}")`
        : 'isDeleted=false && is_draft=false';
      const result = await pocketbase.collection('patterns').getList<TypePatternResponse>(1, 20, {
        filter,
        sort: 'name',
      });
      return result.items;
    },
    placeholderData: (prev) => prev,
  });
};

// ─── Mutations ─────────────────────────────────────────────────────────────────

export const useMutationCreateSet = () => {
  return useMutation({
    mutationFn: async (payload: TypePatternSetPayload): Promise<TypePatternSet> =>
      pocketbase.collection('pattern_sets').create<TypePatternSet>(payload),
  });
};

export const useMutationUpdateSet = () => {
  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<TypePatternSetPayload>;
    }): Promise<TypePatternSet> => pocketbase.collection('pattern_sets').update<TypePatternSet>(id, payload),
  });
};

export const useMutationDeleteSet = () => {
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await pocketbase.collection('pattern_sets').delete(id);
    },
  });
};

// ─── Set follow mutations & queries ───────────────────────────────────────────

/** Fetch all sets the logged-in user follows, with the set expanded. */
export const useQueryGetUserFollowedSets = (userId: string) => {
  return useQuery({
    queryKey: [...FOLLOWED_SETS_QUERY_KEY, userId],
    queryFn: async (): Promise<TypeFollowedSetResponse[]> =>
      pocketbase.collection('user_followed_sets').getFullList({
        filter: `owner_id = "${userId}"`,
        expand: 'set_id',
        sort: '-created',
      }),
    enabled: !!userId,
    refetchOnMount: 'always',
  });
};

export const useMutationFollowSet = () => {
  const { authData } = useGlobalAuthData();
  return useMutation({
    mutationFn: async ({ setId, setUpdated }: { setId: string; setUpdated: string }) => {
      if (!authData?.id) throw new Error('Not authenticated');
      return pocketbase.collection('user_followed_sets').create({
        owner_id: authData.id,
        set_id: setId,
        last_checked_updated: setUpdated,
      });
    },
  });
};

export const useMutationUnfollowSet = () =>
  useMutation({
    mutationFn: async (followRecordId: string): Promise<void> => {
      await pocketbase.collection('user_followed_sets').delete(followRecordId);
    },
  });

export const useMutationDismissSetNotification = () =>
  useMutation({
    mutationFn: async ({ followRecordId, setUpdated }: { followRecordId: string; setUpdated: string }) => {
      await pocketbase.collection('user_followed_sets').update(followRecordId, {
        last_checked_updated: setUpdated,
      });
    },
  });
