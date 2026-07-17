import { createClient } from '@connectrpc/connect'
import type { Client } from '@connectrpc/connect'
import {
  IdentityService,
  ResolveUserResponse_Resolution,
} from '@fair-n-square-co/apis/fairnsquare/service/authx/v1alpha1/authx_api_pb'
import { createAuthServiceTransport } from '../rpc/transport.server'

/**
 * The BFF's connectRPC client for the Go auth service's `IdentityService` (ADR-4).
 *
 * Server-only. The transport and its bearer-token interceptor are shared with every
 * other auth-service client — see {@link createAuthServiceTransport}.
 */

/** How `ResolveUser` resolved the identity — both outcomes are a successful login. */
export type UserResolution = 'created' | 'found'

/** The canonical user record, as the rest of the BFF cares about it. */
export type ResolvedUser = Readonly<{
  id: string
  email: string
  resolution: UserResolution
}>

function createIdentityClient(accessToken: string): Client<typeof IdentityService> {
  return createClient(IdentityService, createAuthServiceTransport(accessToken))
}

/**
 * Resolve the canonical user for a freshly authenticated WorkOS identity,
 * JIT-provisioning them on first login.
 *
 * Idempotent: the first login reports `created`, every later one `found`. Both mean
 * the user has a canonical record, which is the only thing the caller needs to know.
 * Throws if the service is unreachable, rejects the token, or answers with a record
 * the BFF cannot trust — never returns a half-resolved user.
 */
export async function resolveUser({
  accessToken,
  email,
}: {
  accessToken: string
  email: string
}): Promise<ResolvedUser> {
  const response = await createIdentityClient(accessToken).resolveUser({ email })

  // Everything below crosses the BFF boundary, and protobuf's wire format makes no
  // promises about it: `user` is an optional message and `resolution` is an open enum,
  // so a partial answer decodes cleanly into a useless value. Reject it here rather
  // than let an empty user id travel on into the app.
  const resolution = toUserResolution(response.resolution)
  if (!resolution) {
    throw new Error(
      `auth service returned an unusable resolution for ResolveUser: ${response.resolution}`,
    )
  }
  if (!response.user?.id || !response.user.email) {
    throw new Error('auth service returned no canonical user for ResolveUser')
  }

  return { id: response.user.id, email: response.user.email, resolution }
}

function toUserResolution(resolution: ResolveUserResponse_Resolution): UserResolution | null {
  switch (resolution) {
    case ResolveUserResponse_Resolution.CREATED:
      return 'created'
    case ResolveUserResponse_Resolution.FOUND:
      return 'found'
    case ResolveUserResponse_Resolution.UNSPECIFIED:
      return null
    default:
      return null
  }
}
