import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import type { ProfileDraft, SaveProfileResult, UserProfile } from './types'
import { requireSession } from '../auth/session.server'
import { getProfile, updateProfile } from './profile-rpc.server'

/**
 * The seam between TanStack Query and the BFF for the profile.
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
 * Narrow the untyped payload a `POST` server function receives into a trusted
 * {@link ProfileDraft}. This is the BFF boundary going the other way: the browser is
 * sending data, so it is validated before the RPC client trusts it. Every field is a
 * required string (an empty username/currency is valid; a missing one is not).
 */
export function parseProfileDraft(input: unknown): ProfileDraft {
  // The value arrives untyped across the network boundary; narrow it before trusting it.
  if (typeof input !== 'object' || input === null) {
    throw new Error('saveProfile: expected an object payload')
  }
  const record: Record<string, unknown> = input as Record<string, unknown>

  const stringField = (name: keyof ProfileDraft): string => {
    const value = record[name]
    if (typeof value !== 'string') {
      throw new Error(`saveProfile: field "${name}" must be a string`)
    }
    return value
  }

  return {
    username: stringField('username'),
    displayName: stringField('displayName'),
    email: stringField('email'),
    preferredCurrency: stringField('preferredCurrency'),
    locale: stringField('locale'),
    timezone: stringField('timezone'),
  }
}

/**
 * Save the full desired profile state (full-replace). Like `fetchProfile` it is
 * session-gated on the server, so the token never reaches the browser; the returned
 * {@link SaveProfileResult} carries either the persisted profile or a typed,
 * user-correctable failure the screen surfaces inline.
 */
export const saveProfile = createServerFn({ method: 'POST' })
  .validator(parseProfileDraft)
  .handler(async ({ data }): Promise<SaveProfileResult> => {
    const { accessToken } = await requireSession()
    return updateProfile({ accessToken, input: data })
  })

/**
 * Query options for the current user's profile. Shared by the route loader (which
 * prefetches into the cache so the profile is dehydrated into the SSR markup) and
 * the screen (which reads it back with no refetch). One definition, one query key —
 * also the key `saveProfile`'s success writes the refreshed profile back into.
 */
export function profileQueryOptions() {
  return queryOptions({
    queryKey: ['profile'],
    queryFn: () => fetchProfile(),
  })
}
