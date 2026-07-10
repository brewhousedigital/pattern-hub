import PocketBase from 'pocketbase';
import { QueryClient } from '@tanstack/react-query';

export const pocketbaseDomain = 'https://stained-glass.pockethost.io';
export const pocketbase = new PocketBase(pocketbaseDomain);

export const createQueryClient = () =>
  new QueryClient({
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

// Client-side singleton. Mutations/invalidations throughout the app import this
// directly; in the browser it is the same instance the router provides via
// context. On the server, getRouter() creates a fresh QueryClient per request
// instead (the SSR query integration clears its client after every request).
export const queryClient = createQueryClient();

if (typeof window !== 'undefined') {
  const _originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
    try {
      const response = await _originalFetch(...args);
      if (response.status === 429) {
        window.dispatchEvent(new CustomEvent('app:rate-limited'));
      }
      return response;
    } catch (error) {
      // CORS failures and other server-side errors surface as TypeErrors with no HTTP
      // response. If the user is online, this most likely means the server is struggling.
      if (error instanceof TypeError && navigator.onLine) {
        window.dispatchEvent(new CustomEvent('app:rate-limited'));
      }
      throw error;
    }
  };
}
