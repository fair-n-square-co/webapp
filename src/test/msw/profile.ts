import { HttpResponse, http } from 'msw'
import type { RequestHandler } from 'msw'
import { create, fromBinary, toBinary } from '@bufbuild/protobuf'
import {
  GetProfileRequestSchema,
  GetProfileResponseSchema,
  UpdateProfileRequestSchema,
  UpdateProfileResponseSchema,
} from '@fair-n-square-co/apis/fairnsquare/service/authx/v1alpha1/profile_api_pb'
import { authServiceMethodUrl } from './auth-service'

/**
 * MSW handlers for the auth service's `ProfileService`, mocked at the wire (§9)
 * rather than by stubbing our own connectRPC client.
 *
 * Like the identity handlers, these speak real Connect: the BFF's client serializes
 * a request the handler decodes with the generated schema, and only accepts a reply
 * it can decode back. A test therefore fails if we get the protocol, the route, or
 * the message shape wrong — the contract worth guarding.
 */

const GET_PROFILE_URL = authServiceMethodUrl('ProfileService', 'GetProfile')

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
  preferences?: Readonly<{
    preferredCurrency?: string
    locale?: string
    timezone?: string
  }>
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

const UPDATE_PROFILE_URL = authServiceMethodUrl('ProfileService', 'UpdateProfile')

/**
 * What the BFF actually put on the wire for an update, so a test can assert both that
 * the access token rode along AND that the full desired state — including the
 * preferences block with the preserved locale/timezone — was sent (full-replace).
 */
export type RecordedUpdateProfile = Readonly<{
  authorization: string | null
  username: string
  displayName: string
  email: string
  preferredCurrency: string
  locale: string
  timezone: string
}>

export type UpdateProfileOutcome =
  | Readonly<{ kind: 'ok'; profile: WireProfile }>
  /**
   * A username or email already taken by another user. `field` shapes the error
   * message: 'username'/'email' name the offending field, 'unknown' returns a
   * conflict message that names neither, and 'both' names the two at once — in the
   * last two cases the BFF must fall back to `unknown` rather than pick a field.
   */
  | Readonly<{ kind: 'alreadyExists'; field: 'username' | 'email' | 'unknown' | 'both' }>
  /** A server-side validation failure. */
  | Readonly<{ kind: 'invalidArgument'; message?: string }>
  /** The caller has no profile. Impossible after login, so the BFF treats it as a fault. */
  | Readonly<{ kind: 'notFound' }>
  | Readonly<{ kind: 'unavailable' }>

/**
 * Handle `UpdateProfile` with the given outcome, appending each decoded request to
 * `calls` so a test can assert on the token and the full payload it carried.
 */
export function updateProfileHandler(
  outcome: UpdateProfileOutcome,
  calls: RecordedUpdateProfile[],
): RequestHandler {
  return http.post(UPDATE_PROFILE_URL, async ({ request }) => {
    // Decode with the generated schema so a malformed request fails the test.
    const decoded = fromBinary(
      UpdateProfileRequestSchema,
      new Uint8Array(await request.arrayBuffer()),
    )
    calls.push({
      authorization: request.headers.get('authorization'),
      username: decoded.username,
      displayName: decoded.displayName,
      email: decoded.email,
      preferredCurrency: decoded.preferences?.preferredCurrency ?? '',
      locale: decoded.preferences?.locale ?? '',
      timezone: decoded.preferences?.timezone ?? '',
    })

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
    if (outcome.kind === 'alreadyExists') {
      // 'unknown' names neither field and 'both' names them together — either way the
      // BFF's message parsing has nothing unambiguous to latch onto and must fall back
      // to a form-level conflict rather than blaming one input.
      const message =
        outcome.field === 'unknown'
          ? 'that value is already taken'
          : outcome.field === 'both'
            ? 'that username or email is already taken'
            : `that ${outcome.field} is already taken`
      return HttpResponse.json({ code: 'already_exists', message }, { status: 409 })
    }
    if (outcome.kind === 'invalidArgument') {
      return HttpResponse.json(
        { code: 'invalid_argument', message: outcome.message ?? 'invalid profile' },
        { status: 400 },
      )
    }

    const response = create(UpdateProfileResponseSchema, { profile: outcome.profile })
    return HttpResponse.arrayBuffer(toBinary(UpdateProfileResponseSchema, response).buffer, {
      headers: { 'content-type': 'application/proto' },
    })
  })
}
