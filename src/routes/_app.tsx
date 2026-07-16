import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AppShell } from '../components/AppShell'
import { sessionUserQueryOptions } from '../lib/auth/session-user'

// Pathless layout (the `_app` prefix adds no URL segment): it wraps the app's
// screens in the navigation chrome. Bare endpoints that should not have chrome —
// `/healthz`, the server-only `/auth/*` handlers — sit outside it.
export const Route = createFileRoute('/_app')({
  // Who is signed in is app-level state, so it is primed here — once, for every
  // screen under the shell — rather than by each page's own loader. Any screen
  // (current or future) reads it back with
  // `useSuspenseQuery(sessionUserQueryOptions())`; new pages must not wire their own
  // session fetch. It is cheap (derived from the sealed cookie, no Go-service call)
  // and `null` for a signed-out visitor, so it is safe on public screens too.
  // Nothing is returned: the data would be serialized into the loader payload as
  // well, and the dehydrated query stream already carries it to the client.
  loader: async ({ context }): Promise<void> => {
    await context.queryClient.ensureQueryData(sessionUserQueryOptions())
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
