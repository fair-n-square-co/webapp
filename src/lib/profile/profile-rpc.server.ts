import { createClient } from '@connectrpc/connect'
import { Code, ConnectError } from '@connectrpc/connect'
import { ProfileService } from '@fair-n-square-co/apis/fairnsquare/service/authx/v1alpha1/profile_api_pb'
import type { Profile } from '@fair-n-square-co/apis/fairnsquare/service/authx/v1alpha1/profile_types_pb'
import { createAuthServiceTransport } from '../rpc/transport.server'
import type { ConflictField, ProfileDraft, SaveProfileResult, UserProfile } from './types'

/**
 * The BFF's connectRPC client for the Go auth service's `ProfileService` (ADR-4).
 *
 * Server-only. Shares one transport and bearer-token interceptor with every other
 * auth-service client — see {@link createAuthServiceTransport}.
 */

/**
 * Turn a wire `Profile` into the trusted {@link UserProfile}, or throw.
 *
 * Everything here crosses the BFF boundary, and protobuf's wire format makes no
 * promises about it: `profile` is an optional message, so a hollow reply decodes
 * cleanly into a useless value. `userId` and `email` are load-bearing and always set
 * by the service; reject the reply here rather than let empties travel on. `username`
 * and `displayName` may legitimately be empty and are left as-is. `preferences` is an
 * optional sub-message — a caller who never set one has none — so each field defaults
 * to '' when it is absent.
 */
function toUserProfile(profile: Profile | undefined, rpc: string): UserProfile {
  if (!profile) {
    throw new Error(`profile service returned no profile for ${rpc}`)
  }
  if (!profile.userId || !profile.email) {
    throw new Error(`profile service returned a profile with no user id or email for ${rpc}`)
  }

  const preferences = profile.preferences
  return {
    userId: profile.userId,
    username: profile.username,
    displayName: profile.displayName,
    email: profile.email,
    preferredCurrency: preferences?.preferredCurrency ?? '',
    locale: preferences?.locale ?? '',
    timezone: preferences?.timezone ?? '',
  }
}

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

  let profile: Profile | undefined
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

  return toUserProfile(profile, 'GetProfile')
}

/**
 * Best-effort read of which field an `AlreadyExists` conflict was about. The service
 * puts the offending field in the error message; we look for it so the UI can attach
 * the error to the right input. When the message does not say, `unknown` lets the UI
 * fall back to a form-level message rather than mislabelling a field.
 */
function conflictField(error: ConnectError): ConflictField {
  const message = error.rawMessage.toLowerCase()
  const namesUsername = message.includes('username')
  const namesEmail = message.includes('email')
  // Only claim a field when the message implicates exactly one. A message naming both
  // ("username or email is already taken") identifies neither, and picking the first
  // match would pin the error to an input the user may not need to change at all.
  if (namesUsername && !namesEmail) {
    return 'username'
  }
  if (namesEmail && !namesUsername) {
    return 'email'
  }
  return 'unknown'
}

/**
 * Full-replace the caller's mutable profile (PUT semantics): the complete desired
 * state is sent, identity comes from the token, and `locale`/`timezone` ride along in
 * the preferences block unchanged so a save never silently clears them.
 *
 * The two failure modes the user can fix by editing — a taken username/email
 * (`AlreadyExists`) and a validation failure (`InvalidArgument`) — come back as typed
 * {@link SaveProfileResult} values the UI surfaces inline. Everything else (an
 * unreachable service, a `NotFound` that mirrors `getProfile`'s broken-invariant
 * handling, a reply the BFF cannot trust) is thrown as the fault it is.
 */
export async function updateProfile({
  accessToken,
  input,
}: {
  accessToken: string
  input: ProfileDraft
}): Promise<SaveProfileResult> {
  const client = createClient(ProfileService, createAuthServiceTransport(accessToken))

  let profile: Profile | undefined
  try {
    ;({ profile } = await client.updateProfile({
      username: input.username,
      displayName: input.displayName,
      email: input.email,
      preferences: {
        preferredCurrency: input.preferredCurrency,
        locale: input.locale,
        timezone: input.timezone,
      },
    }))
  } catch (error) {
    if (error instanceof ConnectError) {
      if (error.code === Code.AlreadyExists) {
        return { status: 'alreadyExists', field: conflictField(error) }
      }
      if (error.code === Code.InvalidArgument) {
        return { status: 'invalidArgument', message: error.rawMessage }
      }
      // A provisioned user always exists, so NotFound here is the same broken invariant
      // getProfile guards against — a fault, not something the user can edit away.
      if (error.code === Code.NotFound) {
        throw new Error(
          'profile service returned NotFound for an authenticated caller; the user should have been provisioned on login',
          { cause: error },
        )
      }
    }
    throw error
  }

  return { status: 'ok', profile: toUserProfile(profile, 'UpdateProfile') }
}
