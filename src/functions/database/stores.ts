import { pocketbase } from '@/functions/database/authentication-setup';
import { useMutation, useQuery } from '@tanstack/react-query';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TypeStoreLocation = {
  id: string;
  collectionId: string;
  collectionName: string;
  name: string;
  description: string;
  street_address: string;
  phone: string;
  website: string;
  /** PocketBase geoPoint field — shape: { lat: number; lon: number; alt?: number } */
  location: { lat: number; lon: number; alt?: number };
  /** JSON array of tag strings stored in PocketBase as a JSON field */
  tags: string[];
  created: string;
  updated: string;
};

type CreateStorePayload = {
  name: string;
  description: string;
  street_address: string;
  phone: string;
  website: string;
  location: { lat: number; lon: number };
  tags: string[];
};

type UpdateStorePayload = CreateStorePayload & { id: string };

// ─── Admin queries (direct PocketBase, requires admin auth) ───────────────────

export const useQueryGetAllStores = () => {
  return useQuery({
    queryKey: ['GetAllStores'],
    queryFn: async (): Promise<TypeStoreLocation[]> => {
      return await pocketbase.collection('store_locations').getFullList({
        sort: '-created',
      });
    },
    refetchOnMount: 'always',
  });
};

export type TypeStoreAdminQueryParams = {
  /** 0-indexed page (MUI DataGrid convention; +1 before sending to PocketBase). */
  page: number;
  pageSize: number;
  nameSearch: string;
  addressSearch: string;
  phoneSearch: string;
};

export const useQueryGetStoresByPagination = (params: TypeStoreAdminQueryParams) => {
  return useQuery({
    queryKey: ['GetStoresByPagination', params],
    queryFn: async (): Promise<{ items: TypeStoreLocation[]; totalItems: number }> => {
      const safe = (v: string) => v.trim().replace(/"/g, '\\"');
      const filters: string[] = [];
      if (params.nameSearch.trim()) filters.push(`name ~ "${safe(params.nameSearch)}"`);
      if (params.addressSearch.trim()) filters.push(`street_address ~ "${safe(params.addressSearch)}"`);
      if (params.phoneSearch.trim()) filters.push(`phone ~ "${safe(params.phoneSearch)}"`);

      const result = await pocketbase
        .collection('store_locations')
        .getList<TypeStoreLocation>(params.page + 1, params.pageSize, {
          sort: 'name',
          ...(filters.length ? { filter: filters.join(' && ') } : {}),
        });

      return { items: result.items, totalItems: result.totalItems };
    },
    placeholderData: (prev) => prev,
  });
};

// ─── Admin mutations ──────────────────────────────────────────────────────────

export const useMutationCreateStore = () => {
  return useMutation({
    mutationFn: async (payload: CreateStorePayload): Promise<TypeStoreLocation> => {
      return await pocketbase.collection('store_locations').create({
        name: payload.name,
        description: payload.description,
        street_address: payload.street_address,
        phone: payload.phone,
        website: payload.website,
        location: payload.location,
        tags: payload.tags,
      });
    },
  });
};

export const useMutationUpdateStore = () => {
  return useMutation({
    mutationFn: async (payload: UpdateStorePayload): Promise<TypeStoreLocation> => {
      const { id, ...body } = payload;
      return await pocketbase.collection('store_locations').update(id, {
        name: body.name,
        description: body.description,
        street_address: body.street_address,
        phone: body.phone,
        website: body.website,
        location: body.location,
        tags: body.tags,
      });
    },
  });
};

export const useMutationDeleteStore = () => {
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await pocketbase.collection('store_locations').delete(id);
    },
  });
};

// ─── Public query (via Netlify cached endpoint) ───────────────────────────────

export const useQueryGetStoresCached = () => {
  return useQuery({
    queryKey: ['GetStoresCached'],
    queryFn: async (): Promise<TypeStoreLocation[]> => {
      const res = await fetch('/api/get-stores');
      if (!res.ok) throw new Error('Failed to fetch stores');
      const data = await res.json();
      return data.items ?? [];
    },
    staleTime: 60 * 60 * 1000, // 1 hour — matches CDN cache
  });
};

// ─── Geocoding helper (via Netlify proxy) ─────────────────────────────────────

export type TypeNominatimResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
};

export async function geocodeAddress(query: string): Promise<TypeNominatimResult[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('Geocoding failed');
  return res.json();
}

// ─── Haversine distance (client-side, km) ────────────────────────────────────

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
