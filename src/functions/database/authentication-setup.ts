import PocketBase from 'pocketbase';
import { QueryClient } from '@tanstack/react-query';

export const pocketbaseDomain = 'https://stained-glass.pockethost.io';
export const pocketbase = new PocketBase(pocketbaseDomain);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      staleTime: 1000 * 60 * 60, // 1 hour
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

if (typeof window !== 'undefined') {
  const _originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    const response = await _originalFetch(...args);
    if (response.status === 429) {
      window.dispatchEvent(new CustomEvent('app:rate-limited'));
    }
    return response;
  };
}
