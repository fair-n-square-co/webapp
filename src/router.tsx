import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'

/**
 * The router owns the QueryClient and hands it to routes as context, so loaders can
 * prefetch into the cache. `setupRouterSsrQueryIntegration` wires the SSR half:
 * queries fetched during the server render are dehydrated into the streamed HTML and
 * rehydrated on the client, so data is in the markup on first paint and is not
 * refetched on mount. It also wraps the app in a `QueryClientProvider`.
 *
 * A fresh QueryClient is created per `getRouter()` call. Start invokes this factory
 * once per request on the server, so one user's cache is never handed to another.
 */
export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      // Data hydrated from the server is fresh; without a stale window every
      // suspense query would refetch the instant it mounts, undoing the point of
      // dehydrating it. A short window covers the initial paint and normal reads.
      queries: { staleTime: 60_000 },
    },
  })

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
