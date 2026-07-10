import { createRouter } from '@tanstack/react-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import ErrorPage from '@/components/layout/ErrorPage';
import { stringifySearch, parseSearch } from '@/functions/utilities/search-v2';
import { createQueryClient, queryClient as clientQueryClient } from '@/functions/database/authentication-setup';

// Import the generated route tree
import { routeTree } from './routeTree.gen';

export function getRouter() {
  // In the browser reuse the app-wide singleton (imported directly by mutation
  // code for invalidations). On the server, create a fresh client per request -
  // the SSR query integration tears its client down after each request.
  const queryClient = typeof window !== 'undefined' ? clientQueryClient : createQueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    stringifySearch,
    parseSearch,
    defaultErrorComponent: ({ error, reset }) => <ErrorPage error={error} onReset={reset} />,
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
