import { HttpResponse, http } from 'msw'
import type { RequestHandler } from 'msw'
import { create, fromBinary, toBinary } from '@bufbuild/protobuf'
import {
  GetProfileRequestSchema,
  GetProfileResponseSchema,
} from '@fair-n-square-co/apis/fairnsquare/service/authx/v1alpha1/profile_api_pb'

/**
 * MSW handlers for the auth service's `ProfileService`, mocked at the wire (§9)
 * rather than by stubbing our own connectRPC client.
 *
 * Like the identity handlers, these speak real Connect: the BFF's client serializes
 * a request the handler decodes with the generated schema, and only accepts a reply
 * it can decode back. A test therefore fails if we get the protocol, the route, or
 * the message shape wrong — the contract worth guarding.
 */

/** Matches `AUTH_SERVICE_BASE_URL` in the tests that install these handlers. */
export const TEST_AUTH_SERVICE_BASE_URL = 'http://auth.test'

// Connect addresses a unary method as POST <baseUrl>/<package>.<Service>/<Method>.
const GET_PROFILE_URL = `${TEST_AUTH_SERVICE_BASE_URL}/fairnsquare.service.authx.v1alpha1.ProfileService/GetProfile`

/** What the BFF actually put on the wire, so a test can assert on it. */
export type RecordedGetProfile = Readonly<{
  authorization: string | null
}>

/** A profile as it would come back on the wire. All fields optional to model partials. */
export type WireProfile = Readonly<{
  userId?: string
  username?: string
  displayName?: string
  email?: string
}>

export type GetProfileOutcome =
  | Readonly<{ kind: 'ok'; profile: WireProfile }>
  /** A decodable-but-empty reply carrying no profile message — the BFF must refuse it. */
  | Readonly<{ kind: 'noProfile' }>
  /** The user was never provisioned. Impossible after login, so the BFF treats it as a fault. */
  | Readonly<{ kind: 'notFound' }>
  | Readonly<{ kind: 'unavailable' }>

/**
 * Handle `GetProfile` with the given outcome, appending each call to `calls` so a
 * test can assert the access token rode along in the `Authorization` metadata.
 */
export function getProfileHandler(
  outcome: GetProfileOutcome,
  calls: RecordedGetProfile[],
): RequestHandler {
  return http.post(GET_PROFILE_URL, async ({ request }) => {
    // Decode with the generated schema so a malformed request fails the test.
    fromBinary(GetProfileRequestSchema, new Uint8Array(await request.arrayBuffer()))
    calls.push({ authorization: request.headers.get('authorization') })

    if (outcome.kind === 'unavailable') {
      return HttpResponse.json(
        { code: 'unavailable', message: 'profile service is down' },
        { status: 503 },
      )
    }
    if (outcome.kind === 'notFound') {
      return HttpResponse.json(
        { code: 'not_found', message: 'no profile for caller' },
        { status: 404 },
      )
    }

    const response =
      outcome.kind === 'noProfile'
        ? create(GetProfileResponseSchema, {})
        : create(GetProfileResponseSchema, { profile: outcome.profile })

    return HttpResponse.arrayBuffer(toBinary(GetProfileResponseSchema, response).buffer, {
      headers: { 'content-type': 'application/proto' },
    })
  })
}
