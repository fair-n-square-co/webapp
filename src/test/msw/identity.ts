import { HttpResponse, http } from 'msw'
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

export type ResolveUserOutcome =
  | Readonly<{ kind: 'resolved'; resolution: ResolveUserResponse_Resolution }>
  /** A well-formed reply the BFF must still refuse: no user, or an unusable resolution. */
  | Readonly<{ kind: 'incomplete' }>
  | Readonly<{ kind: 'unavailable' }>

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
        : create(ResolveUserResponseSchema, {
            resolution: outcome.resolution,
            user: { id: 'user_01HZY', email: message.email },
          })

    return HttpResponse.arrayBuffer(toBinary(ResolveUserResponseSchema, response).buffer, {
      headers: { 'content-type': 'application/proto' },
    })
  })
}
