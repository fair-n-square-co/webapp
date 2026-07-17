import { createClient } from '@connectrpc/connect'
import { Code, ConnectError } from '@connectrpc/connect'
import { ProfileService } from '@fair-n-square-co/apis/fairnsquare/service/authx/v1alpha1/profile_api_pb'
import { createAuthServiceTransport } from '../rpc/transport.server'
import type { UserProfile } from './types'

/**
 * The BFF's connectRPC client for the Go auth service's `ProfileService` (ADR-4).
 *
 * Server-only. Shares one transport and bearer-token interceptor with every other
 * auth-service client — see {@link createAuthServiceTransport}.
 */

/**
 * Read the caller's own profile, identified by their WorkOS access token.
 *
 * Throws — never returns a hollow profile — if the service is unreachable, rejects
 * the token, or answers with a record the BFF cannot trust. `NotFound` is included
 * in that: after JIT provisioning (ResolveUser on first login) every authenticated
 * caller has a profile, so its absence is a real fault, not an empty state.
 */
export async function getProfile({ accessToken }: { accessToken: string }): Promise<UserProfile> {
  const client = createClient(ProfileService, createAuthServiceTransport(accessToken))

  let profile
  try {
    ;({ profile } = await client.getProfile({}))
  } catch (error) {
    // A provisioned user always has a profile, so NotFound is not "nothing to show" —
    // it means the invariant ResolveUser is supposed to guarantee has been broken.
    // Surface it as the fault it is rather than letting it read as an empty profile.
    if (error instanceof ConnectError && error.code === Code.NotFound) {
      throw new Error(
        'profile service returned NotFound for an authenticated caller; the user should have been provisioned on login',
        { cause: error },
      )
    }
    throw error
  }

  // Everything below crosses the BFF boundary, and protobuf's wire format makes no
  // promises about it: `profile` is an optional message, so a hollow reply decodes
  // cleanly into a useless value. `userId` and `email` are load-bearing and always
  // set by the service; reject the reply here rather than let empties travel on.
  // `username` and `displayName` may legitimately be empty and are left as-is.
  if (!profile) {
    throw new Error('profile service returned no profile for GetProfile')
  }
  if (!profile.userId || !profile.email) {
    throw new Error('profile service returned a profile with no user id or email for GetProfile')
  }

  return {
    userId: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    email: profile.email,
  }
}
