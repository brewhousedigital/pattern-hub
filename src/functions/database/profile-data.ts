import { useQuery } from '@tanstack/react-query';
import { pocketbaseDomain } from '@/functions/database/authentication-setup';
import type { TypePaginationDatabaseResponse, TypeFavoriteDoneRatingsResponse } from '@/functions/types/types';
import type { TypeGalleryResponse } from '@/functions/database/gallery';
import type { TypeCollectionResponse, TypeFollowedCollectionResponse } from '@/functions/database/collections';
import type { TypePatternResponse } from '@/functions/database/patterns';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProfileDataParams = {
  userId: string;
  favPage: number;
  donePage: number;
  ratingsPage: number;
  difficultyPage: number;
  galleryPage: number;
  collectionsPage: number;
  artistPage: number;
  isOwner: boolean;
  isArtist: boolean;
};

export type TypeProfileDataResponse = {
  favorites: TypePaginationDatabaseResponse<TypeFavoriteDoneRatingsResponse>;
  done: TypePaginationDatabaseResponse<TypeFavoriteDoneRatingsResponse>;
  ratings: TypePaginationDatabaseResponse<TypeFavoriteDoneRatingsResponse>;
  difficulty: TypePaginationDatabaseResponse<TypeFavoriteDoneRatingsResponse>;
  gallery: TypePaginationDatabaseResponse<TypeGalleryResponse>;
  collections: TypePaginationDatabaseResponse<TypeCollectionResponse>;
  followedCollections: TypeFollowedCollectionResponse[] | null;
  artistPatterns: TypePaginationDatabaseResponse<TypePatternResponse> | null;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useQueryGetProfileData = (params: ProfileDataParams) => {
  return useQuery({
    queryKey: ['ProfileData', params],
    queryFn: async (): Promise<TypeProfileDataResponse> => {
      const p = new URLSearchParams({
        userId:         params.userId,
        favPage:        String(params.favPage),
        donePage:       String(params.donePage),
        ratingPage:     String(params.ratingsPage),
        diffPage:       String(params.difficultyPage),
        galleryPage:    String(params.galleryPage),
        colsPage:       String(params.collectionsPage),
        artistPage:     String(params.artistPage),
        isOwner:        String(params.isOwner),
        isArtist:       String(params.isArtist),
      });
      const res = await fetch(`${pocketbaseDomain}/api/profile-data?${p}`);
      if (!res.ok) throw new Error('Failed to load profile data');
      return res.json() as Promise<TypeProfileDataResponse>;
    },
    enabled: !!params.userId,
    refetchOnMount: 'always',
  });
};
