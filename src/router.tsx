import { QueryClient } from '@tanstack/react-query'
import { createRouter, isRedirect } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'
import { NotFound } from './components/NotFound'
import { ErrorScreen } from './components/ErrorScreen'

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
      queries: {
        // Data hydrated from the server is fresh; without a stale window every
        // suspense query would refetch the instant it mounts, undoing the point of
        // dehydrating it. A short window covers the initial paint and normal reads.
        staleTime: 60_000,
        // A server function that session-gates (e.g. `fetchProfile`) rejects with a
        // *redirect*, not a failure. Retrying one is pointless — the answer will not
        // change — and the router can only act on it (see `handleRedirects` in the
        // SSR-query integration) once retries are exhausted. Without this guard, a
        // signed-out visitor client-navigating to a gated screen would sit through
        // three retries with backoff before being sent to login.
        retry: (failureCount, error) => !isRedirect(error) && failureCount < 3,
      },
    },
  })

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    // Unknown URLs and thrown render/loader errors render inside the app shell, so
    // every page — even these — keeps the nav and never becomes a dead end.
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: ErrorScreen,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
