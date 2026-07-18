import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { server } from '../../test/msw/server'
import { TEST_AUTH_SERVICE_BASE_URL } from '../../test/msw/auth-service'
import {
  getProfileHandler,
  updateProfileHandler,
  type GetProfileOutcome,
  type RecordedGetProfile,
  type RecordedUpdateProfile,
  type UpdateProfileOutcome,
} from '../../test/msw/profile'
import { getProfile, updateProfile } from './profile-rpc.server'
import type { ProfileDraft } from './types'

// The BFF boundary for GetProfile, exercised at the wire: a real Connect request the
// MSW handler decodes with the generated schema, and a real Connect reply the client
// decodes back. Same style as the identity handlers — nothing stubs our own client.

const ACCESS_TOKEN = 'workos-access-token'

let originalEnv: NodeJS.ProcessEnv
let calls: RecordedGetProfile[]

/** Point the profile service at an outcome; every call it receives lands in `calls`. */
function profileServiceAnswers(outcome: GetProfileOutcome): void {
  server.use(getProfileHandler(outcome, calls))
}

beforeEach(() => {
  originalEnv = { ...process.env }
  process.env['AUTH_SERVICE_BASE_URL'] = TEST_AUTH_SERVICE_BASE_URL
  calls = []
})

afterEach(() => {
  process.env = originalEnv
})

describe('getProfile', () => {
  it('returns the profile and forwards the access token as bearer metadata', async () => {
    profileServiceAnswers({
      kind: 'ok',
      profile: {
        userId: 'user_01HZY',
        username: 'ada',
        displayName: 'Ada Lovelace',
        email: 'ada@example.com',
        preferences: {
          preferredCurrency: 'AUD',
          locale: 'en-AU',
          timezone: 'Australia/Sydney',
        },
      },
    })

    const profile = await getProfile({ accessToken: ACCESS_TOKEN })

    expect(profile).toEqual({
      userId: 'user_01HZY',
      username: 'ada',
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
      preferredCurrency: 'AUD',
      locale: 'en-AU',
      timezone: 'Australia/Sydney',
    })
    // ADR-4 zero trust: identity travels in the token, never the body.
    expect(calls).toEqual([{ authorization: `Bearer ${ACCESS_TOKEN}` }])
  })

  it('defaults every preference to empty when the profile carries no preferences block', async () => {
    // `preferences` is an optional sub-message: a user who never set one has none, and
    // that must decode into empty strings, not undefined leaking past the boundary.
    profileServiceAnswers({
      kind: 'ok',
      profile: { userId: 'user_01HZY', username: 'ada', displayName: 'Ada', email: 'ada@x.com' },
    })

    const profile = await getProfile({ accessToken: ACCESS_TOKEN })

    expect(profile.preferredCurrency).toBe('')
    expect(profile.locale).toBe('')
    expect(profile.timezone).toBe('')
  })

  it('accepts an empty username and display name as a normal state', async () => {
    // JIT-provisioned users have no username yet (optional-when-empty); a fresh user
    // may also have no display name. Neither is an error the boundary should reject.
    profileServiceAnswers({
      kind: 'ok',
      profile: { userId: 'user_01HZY', username: '', displayName: '', email: 'ada@example.com' },
    })

    const profile = await getProfile({ accessToken: ACCESS_TOKEN })

    expect(profile.username).toBe('')
    expect(profile.displayName).toBe('')
    expect(profile.email).toBe('ada@example.com')
  })

  it('treats NotFound as a fault, not an empty profile', async () => {
    // After JIT provisioning every authenticated caller has a profile, so its absence
    // means a broken invariant, not "nothing to show".
    profileServiceAnswers({ kind: 'notFound' })

    await expect(getProfile({ accessToken: ACCESS_TOKEN })).rejects.toThrow(/NotFound|provisioned/)
  })

  it('rejects a reply that carries no profile message', async () => {
    // `profile` is an optional message, so an empty response decodes cleanly into one
    // that means nothing. It must not travel on as a hollow profile.
    profileServiceAnswers({ kind: 'noProfile' })

    await expect(getProfile({ accessToken: ACCESS_TOKEN })).rejects.toThrow(/no profile/)
  })

  it('rejects a profile with no user id', async () => {
    profileServiceAnswers({
      kind: 'ok',
      profile: { userId: '', username: 'ada', displayName: 'Ada', email: 'ada@example.com' },
    })

    await expect(getProfile({ accessToken: ACCESS_TOKEN })).rejects.toThrow(/no user id or email/)
  })

  it('rejects a profile with no email', async () => {
    // `email` is as load-bearing as `userId` and just as optional on the wire.
    profileServiceAnswers({
      kind: 'ok',
      profile: { userId: 'user_01HZY', username: 'ada', displayName: 'Ada', email: '' },
    })

    await expect(getProfile({ accessToken: ACCESS_TOKEN })).rejects.toThrow(/no user id or email/)
  })

  it('throws when the profile service is unavailable', async () => {
    profileServiceAnswers({ kind: 'unavailable' })

    await expect(getProfile({ accessToken: ACCESS_TOKEN })).rejects.toThrow()
  })
})

describe('updateProfile', () => {
  let updateCalls: RecordedUpdateProfile[]

  function updateServiceAnswers(outcome: UpdateProfileOutcome): void {
    server.use(updateProfileHandler(outcome, updateCalls))
  }

  const DRAFT: ProfileDraft = {
    username: 'ada',
    displayName: 'Ada Lovelace',
    email: 'ada@example.com',
    preferredCurrency: 'AUD',
    locale: 'en-AU',
    timezone: 'Australia/Sydney',
  }

  /** The wire profile a service would echo back for a saved draft. */
  function persisted(draft: ProfileDraft) {
    return {
      userId: 'user_01HZY',
      username: draft.username,
      displayName: draft.displayName,
      email: draft.email,
      preferences: {
        preferredCurrency: draft.preferredCurrency,
        locale: draft.locale,
        timezone: draft.timezone,
      },
    } as const
  }

  beforeEach(() => {
    updateCalls = []
  })

  it('sends the full desired state — token, identity fields and the whole preferences block', async () => {
    // Full-replace / PUT: identity rides in the token, and locale/timezone are sent even
    // though the edit UI never touches them, so the service does not clear them.
    updateServiceAnswers({ kind: 'ok', profile: persisted(DRAFT) })

    const result = await updateProfile({ accessToken: ACCESS_TOKEN, input: DRAFT })

    expect(result).toEqual({
      status: 'ok',
      profile: { userId: 'user_01HZY', ...DRAFT },
    })
    expect(updateCalls).toEqual([
      {
        authorization: `Bearer ${ACCESS_TOKEN}`,
        username: 'ada',
        displayName: 'Ada Lovelace',
        email: 'ada@example.com',
        preferredCurrency: 'AUD',
        locale: 'en-AU',
        timezone: 'Australia/Sydney',
      },
    ])
  })

  it('accepts an empty username as a valid save', async () => {
    // Optional-when-empty: clearing the handle is a normal update, not a validation error.
    const draft: ProfileDraft = { ...DRAFT, username: '' }
    updateServiceAnswers({ kind: 'ok', profile: persisted(draft) })

    const result = await updateProfile({ accessToken: ACCESS_TOKEN, input: draft })

    expect(result.status).toBe('ok')
    expect(updateCalls[0]?.username).toBe('')
  })

  it('maps a taken username to an alreadyExists result on the username field', async () => {
    updateServiceAnswers({ kind: 'alreadyExists', field: 'username' })

    const result = await updateProfile({ accessToken: ACCESS_TOKEN, input: DRAFT })

    expect(result).toEqual({ status: 'alreadyExists', field: 'username' })
  })

  it('maps a taken email to an alreadyExists result on the email field', async () => {
    updateServiceAnswers({ kind: 'alreadyExists', field: 'email' })

    const result = await updateProfile({ accessToken: ACCESS_TOKEN, input: DRAFT })

    expect(result).toEqual({ status: 'alreadyExists', field: 'email' })
  })

  it('maps a validation failure to an invalidArgument result carrying the message', async () => {
    updateServiceAnswers({ kind: 'invalidArgument', message: 'username must be 3-30 characters' })

    const result = await updateProfile({ accessToken: ACCESS_TOKEN, input: DRAFT })

    expect(result).toEqual({
      status: 'invalidArgument',
      message: 'username must be 3-30 characters',
    })
  })

  it('rejects a reply that carries no profile message', async () => {
    // A decodable-but-empty response must not travel on as a hollow profile.
    updateServiceAnswers({ kind: 'ok', profile: {} })

    await expect(updateProfile({ accessToken: ACCESS_TOKEN, input: DRAFT })).rejects.toThrow(
      /no user id or email/,
    )
  })

  it('throws — rather than returning a result — when the service is unavailable', async () => {
    // An unreachable service is a fault, not something the user can fix by editing.
    updateServiceAnswers({ kind: 'unavailable' })

    await expect(updateProfile({ accessToken: ACCESS_TOKEN, input: DRAFT })).rejects.toThrow()
  })
})
