import { HttpResponse, delay, http } from 'msw'
import type { RequestHandler } from 'msw'
import { create, fromBinary, toBinary } from '@bufbuild/protobuf'
import {
  ResolveUserRequestSchema,
  ResolveUserResponseSchema,
  ResolveUserResponse_Resolution,
} from '@fair-n-square-co/apis/fairnsquare/service/authx/v1alpha1/authx_api_pb'

/**
 * MSW handlers for the auth service's `IdentityService`, mocked at the wire (§9)
 * rather than by stubbing our own connectRPC client.
 *
 * That means these speak real Connect: the BFF's client serializes a request the
 * handler has to decode with the generated schema, and only accepts a reply it can
 * decode back. A test therefore fails if we get the protocol, the route, or the
 * message shape wrong — which is precisely the contract worth guarding.
 */

/** Matches `AUTH_SERVICE_BASE_URL` in the tests that install these handlers. */
export const TEST_AUTH_SERVICE_BASE_URL = 'http://auth.test'

// Connect addresses a unary method as POST <baseUrl>/<package>.<Service>/<Method>.
const RESOLVE_USER_URL = `${TEST_AUTH_SERVICE_BASE_URL}/fairnsquare.service.authx.v1alpha1.IdentityService/ResolveUser`

/** What the BFF actually put on the wire, so a test can assert on it. */
export type RecordedResolveUser = Readonly<{
  email: string
  authorization: string | null
}>

/** How long a `stalls` outcome hangs for — comfortably past any timeout a test sets. */
export const STALL_MS = 400

export type ResolveUserOutcome =
  | Readonly<{ kind: 'resolved'; resolution: ResolveUserResponse_Resolution }>
  /** Well-formed replies the BFF must still refuse: no usable resolution, or no email. */
  | Readonly<{ kind: 'incomplete' }>
  | Readonly<{ kind: 'userWithoutEmail' }>
  | Readonly<{ kind: 'unavailable' }>
  /** Accepts the request, then never answers — the case a deadline exists for. */
  | Readonly<{ kind: 'stalls' }>

/**
 * Handle `ResolveUser` with the given outcome, appending each call to `calls`.
 * Both `CREATED` and `FOUND` are ordinary successes — the difference is only whether
 * this was the user's first login.
 */
export function resolveUserHandler(
  outcome: ResolveUserOutcome,
  calls: RecordedResolveUser[],
): RequestHandler {
  return http.post(RESOLVE_USER_URL, async ({ request }) => {
    const message = fromBinary(
      ResolveUserRequestSchema,
      new Uint8Array(await request.arrayBuffer()),
    )
    calls.push({
      email: message.email,
      authorization: request.headers.get('authorization'),
    })

    if (outcome.kind === 'stalls') {
      await delay(STALL_MS)
    }

    if (outcome.kind === 'unavailable') {
      // Connect reports errors as JSON with an HTTP status, whatever the body format.
      return HttpResponse.json(
        { code: 'unavailable', message: 'auth service is down' },
        { status: 503 },
      )
    }

    const response =
      outcome.kind === 'incomplete'
        ? create(ResolveUserResponseSchema, {
            resolution: ResolveUserResponse_Resolution.UNSPECIFIED,
          })
        : outcome.kind === 'userWithoutEmail'
          ? create(ResolveUserResponseSchema, {
              resolution: ResolveUserResponse_Resolution.CREATED,
              user: { id: 'user_01HZY' },
            })
          : create(ResolveUserResponseSchema, {
              resolution:
                outcome.kind === 'stalls'
                  ? ResolveUserResponse_Resolution.FOUND
                  : outcome.resolution,
              user: { id: 'user_01HZY', email: message.email },
            })

    return HttpResponse.arrayBuffer(toBinary(ResolveUserResponseSchema, response).buffer, {
      headers: { 'content-type': 'application/proto' },
    })
  })
}
