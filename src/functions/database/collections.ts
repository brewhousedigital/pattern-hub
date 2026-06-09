import { useQuery, useMutation, keepPreviousData } from '@tanstack/react-query';
import { pocketbase } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse } from '@/functions/types/types';
import type { TypePatternResponse } from '@/functions/database/patterns';
import type { TypeAuthData } from '@/functions/database/authentication';
import { useGlobalAuthData } from '@/data/auth-data';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TypeCollectionResponse = {
  collectionId: string;
  collectionName: string;
  id: string;
  name: string;
  description: string;
  owner_id: string;
  patterns: string[]; // array of pattern IDs
  created: string;
  updated: string;
  expand?: {
    patterns?: TypePatternResponse[];
    owner_id?: TypeAuthData;
  };
};

export type TypeFollowedCollectionResponse = {
  collectionId: string;
  collectionName: string;
  id: string;
  owner_id: string;
  collection_id: string;
  last_checked_updated: string;
  created: string;
  updated: string;
  expand?: {
    collection_id?: TypeCollectionResponse;
  };
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export const useQueryGetUserCollections = (userId: string, pageNumber: number) => {
  return useQuery({
    queryKey: ['GetUserCollections', userId, pageNumber],
    queryFn: async (): Promise<TypePaginationDatabaseResponse<TypeCollectionResponse>> => {
      return await pocketbase.collection('user_collections').getList(pageNumber, 10, {
        sort: '-created',
        filter: `owner_id = "${userId}"`,
      });
    },
    enabled: !!userId && !!pageNumber,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
};

export const useQueryGetCollectionById = (collectionId: string) => {
  return useQuery({
    queryKey: ['GetCollectionById', collectionId],
    queryFn: async (): Promise<TypeCollectionResponse> => {
      return await pocketbase.collection('user_collections').getOne(collectionId, {
        expand: 'patterns,patterns.authors,owner_id',
      });
    },
    enabled: !!collectionId,
  });
};

/** Fetch all collections that the logged-in user owns — lightweight, no expand. */
export const useQueryGetUserCollectionsAll = (userId: string) => {
  return useQuery({
    queryKey: ['GetUserCollectionsAll', userId],
    queryFn: async (): Promise<TypeCollectionResponse[]> => {
      return await pocketbase.collection('user_collections').getFullList({
        sort: '-created',
        filter: `owner_id = "${userId}"`,
      });
    },
    enabled: !!userId,
    refetchOnMount: 'always',
  });
};

/** Fetch all collections the logged-in user follows, with the collection expanded. */
export const useQueryGetUserFollowedCollections = (userId: string) => {
  return useQuery({
    queryKey: ['GetUserFollowedCollections', userId],
    queryFn: async (): Promise<TypeFollowedCollectionResponse[]> => {
      return await pocketbase.collection('user_followed_collections').getFullList({
        filter: `owner_id = "${userId}"`,
        expand: 'collection_id,collection_id.owner_id',
        sort: '-created',
      });
    },
    enabled: !!userId,
    refetchOnMount: 'always',
  });
};

// ─── Mutations ────────────────────────────────────────────────────────────────

export const useMutationCreateCollection = () => {
  const { authData } = useGlobalAuthData();

  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      return await pocketbase.collection('user_collections').create({
        name,
        description,
        owner_id: authData?.id,
        patterns: [],
      });
    },
  });
};

export const useMutationUpdateCollectionPatterns = () => {
  return useMutation({
    mutationFn: async ({ collectionId, patternIds }: { collectionId: string; patternIds: string[] }) => {
      return await pocketbase.collection('user_collections').update(collectionId, {
        patterns: patternIds,
      });
    },
  });
};

export const useMutationUpdateCollection = () => {
  return useMutation({
    mutationFn: async ({
      collectionId,
      name,
      description,
      patterns,
    }: {
      collectionId: string;
      name: string;
      description: string;
      patterns?: string[];
    }) => {
      return await pocketbase.collection('user_collections').update(collectionId, {
        name,
        description,
        ...(patterns !== undefined && { patterns }),
      });
    },
  });
};

export const useMutationDeleteCollection = () => {
  return useMutation({
    mutationFn: async (collectionId: string) => {
      await pocketbase.collection('user_collections').delete(collectionId);
    },
  });
};

export const useMutationFollowCollection = () => {
  const { authData } = useGlobalAuthData();

  return useMutation({
    mutationFn: async ({ collectionId, collectionUpdated }: { collectionId: string; collectionUpdated: string }) => {
      return await pocketbase.collection('user_followed_collections').create({
        owner_id: authData?.id,
        collection_id: collectionId,
        last_checked_updated: collectionUpdated,
      });
    },
  });
};

export const useMutationUnfollowCollection = () => {
  return useMutation({
    mutationFn: async (followRecordId: string) => {
      await pocketbase.collection('user_followed_collections').delete(followRecordId);
    },
  });
};

export const useMutationDismissCollectionNotification = () => {
  return useMutation({
    mutationFn: async ({
      followRecordId,
      collectionUpdated,
    }: {
      followRecordId: string;
      collectionUpdated: string;
    }) => {
      await pocketbase.collection('user_followed_collections').update(followRecordId, {
        last_checked_updated: collectionUpdated,
      });
    },
  });
};
