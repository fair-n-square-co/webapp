import { createClient } from '@connectrpc/connect'
import type { Client, Interceptor } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import {
  IdentityService,
  ResolveUserResponse_Resolution,
} from '@fair-n-square-co/apis/fairnsquare/service/authx/v1alpha1/authx_api_pb'
import { getAuthServiceConfig } from '../auth/config.server'

/**
 * The BFF's connectRPC client for the Go auth service (ADR-4).
 *
 * Server-only. The WorkOS access token never leaves this process: it is attached
 * to each call as `Authorization: Bearer <token>` metadata, and the service derives
 * the caller's issuer/subject from it rather than trusting anything in the body.
 */

/** How `ResolveUser` resolved the identity — both outcomes are a successful login. */
export type UserResolution = 'created' | 'found'

/** The canonical user record, as the rest of the BFF cares about it. */
export type ResolvedUser = Readonly<{
  id: string
  email: string
  resolution: UserResolution
}>

function bearerToken(accessToken: string): Interceptor {
  return (next) => (req) => {
    req.header.set('Authorization', `Bearer ${accessToken}`)
    return next(req)
  }
}

/**
 * A client is built per call rather than cached: the bearer token is baked into the
 * interceptor, so a shared client would forward one user's token on another's call.
 * The transport is a thin wrapper over `fetch`, so building one is cheap.
 *
 * `connect-web`, not `connect-node`, despite this running on the server: it is the
 * fetch-based transport, and this server is already fetch-native (the Start runtime
 * hands us `Request`/`Response`). connect-node instead reaches for `node:http`
 * directly, which buys us HTTP/2 we don't need for unary calls and costs us a
 * transport no `fetch` interceptor — MSW in tests, tracing later — can see.
 */
function createIdentityClient(accessToken: string): Client<typeof IdentityService> {
  const { baseUrl, timeoutMs } = getAuthServiceConfig()

  const transport = createConnectTransport({
    baseUrl,
    // This transport defaults to JSON, which exists to keep payloads debuggable in a
    // browser's network tab. Nothing here is server→server debuggable that way, so take
    // the binary wire format the Go service already speaks.
    useBinaryFormat: true,
    // A call with no deadline can hang the login for as long as the auth service stalls.
    defaultTimeoutMs: timeoutMs,
    interceptors: [bearerToken(accessToken)],
  })

  return createClient(IdentityService, transport)
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
