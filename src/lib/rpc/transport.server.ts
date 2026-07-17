import type { Interceptor, Transport } from '@connectrpc/connect'
import { createConnectTransport } from '@connectrpc/connect-web'
import { getAuthServiceConfig } from '../auth/config.server'

/**
 * The BFF's shared connectRPC transport for the Go auth service (ADR-4).
 *
 * Server-only. Both services the auth process exposes — `IdentityService` and
 * `ProfileService` — live behind the same base URL and the same zero-trust rule:
 * the WorkOS access token never leaves this process. It rides on each call as
 * `Authorization: Bearer <token>` metadata, and the service derives the caller's
 * issuer/subject from it rather than trusting anything in the body.
 */

/** Attaches the caller's WorkOS access token to every request on this transport. */
function bearerToken(accessToken: string): Interceptor {
  return (next) => (req) => {
    req.header.set('Authorization', `Bearer ${accessToken}`)
    return next(req)
  }
}

/**
 * Build a transport for the auth service, carrying `accessToken` on every call.
 *
 * A transport is built per call rather than cached: the bearer token is baked into
 * the interceptor, so a shared transport would forward one user's token on another's
 * call. The transport is a thin wrapper over `fetch`, so building one is cheap.
 *
 * `connect-web`, not `connect-node`, despite this running on the server: it is the
 * fetch-based transport, and this server is already fetch-native (the Start runtime
 * hands us `Request`/`Response`). connect-node instead reaches for `node:http`
 * directly, which buys us HTTP/2 we don't need for unary calls and costs us a
 * transport no `fetch` interceptor — MSW in tests, tracing later — can see.
 */
export function createAuthServiceTransport(accessToken: string): Transport {
  const { baseUrl, timeoutMs } = getAuthServiceConfig()

  return createConnectTransport({
    baseUrl,
    // This transport defaults to JSON, which exists to keep payloads debuggable in a
    // browser's network tab. Nothing here is server→server debuggable that way, so take
    // the binary wire format the Go service already speaks.
    useBinaryFormat: true,
    // A call with no deadline can hang a request for as long as the auth service stalls.
    defaultTimeoutMs: timeoutMs,
    interceptors: [bearerToken(accessToken)],
  })
}
