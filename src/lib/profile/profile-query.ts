import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import type { UserProfile } from './types'
import { requireSession } from '../auth/session.server'
import { getProfile } from './profile-rpc.server'

/**
 * The seam between TanStack Query and the BFF for the read-only profile.
 *
 * `fetchProfile` is a server function: its body runs only on the server, so the
 * WorkOS session, the access token, and the connectRPC client never reach the
 * browser bundle. On a client-side navigation the same call becomes an RPC to this
 * BFF. Session-gating lives here — `requireSession()` redirects an anonymous caller
 * to login — so a loader that prefetches through Query inherits the gate.
 */
export const fetchProfile = createServerFn({ method: 'GET' }).handler(
  async (): Promise<UserProfile> => {
    const { accessToken } = await requireSession()
    return getProfile({ accessToken })
  },
)

/**
 * Query options for the current user's profile. Shared by the route loader (which
 * prefetches into the cache so the profile is dehydrated into the SSR markup) and
 * the screen (which reads it back with no refetch). One definition, one query key.
 */
export function profileQueryOptions() {
  return queryOptions({
    queryKey: ['profile'],
    queryFn: () => fetchProfile(),
  })
}
