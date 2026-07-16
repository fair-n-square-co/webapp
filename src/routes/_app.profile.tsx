import { createFileRoute } from '@tanstack/react-router'
import { ProfileScreen } from '../components/ProfileScreen'
import { profileQueryOptions } from '../lib/profile/profile-query'

// This is the repo's first data-backed screen: the loader session-gates and warms
// the cache, the component reads it back. `ensureQueryData` runs the profile fetch on
// the server so it dehydrates into the SSR markup; the fetch is a server function
// that calls `requireSession()`, so an anonymous visitor is redirected to login and
// the profile RPC (and the WorkOS token) never reach the client. The router owns the
// redirect — it unwinds this loader — while Query owns the data. Nothing is returned:
// the data would be serialized into the loader payload as well, and the dehydrated
// query stream already carries it to the client.
export const Route = createFileRoute('/_app/profile')({
  loader: async ({ context }): Promise<void> => {
    await context.queryClient.ensureQueryData(profileQueryOptions())
  },
  component: ProfileScreen,
})
