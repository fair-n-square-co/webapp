import { createFileRoute } from '@tanstack/react-router'
import { ProfileScreen } from '../components/ProfileScreen'
import { profileQueryOptions } from '../lib/profile/profile-query'

// This is the repo's first data-backed screen: the loader session-gates and warms
// the cache, the component reads it back. `ensureQueryData` runs the profile fetch on
// the server so it dehydrates into the SSR markup; the fetch is a server function
// that calls `requireSession()`, so an anonymous visitor is redirected to login and
// the profile RPC (and the WorkOS token) never reach the client. The router owns the
// redirect — it unwinds this loader — while Query owns the data.
export const Route = createFileRoute('/_app/profile')({
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQueryOptions()),
  component: ProfileScreen,
})
