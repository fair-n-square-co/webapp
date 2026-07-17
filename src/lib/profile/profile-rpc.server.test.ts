import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { server } from '../../test/msw/server'
import { TEST_AUTH_SERVICE_BASE_URL } from '../../test/msw/auth-service'
import {
  getProfileHandler,
  type GetProfileOutcome,
  type RecordedGetProfile,
} from '../../test/msw/profile'
import { getProfile } from './profile-rpc.server'

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
      },
    })

    const profile = await getProfile({ accessToken: ACCESS_TOKEN })

    expect(profile).toEqual({
      userId: 'user_01HZY',
      username: 'ada',
      displayName: 'Ada Lovelace',
      email: 'ada@example.com',
    })
    // ADR-4 zero trust: identity travels in the token, never the body.
    expect(calls).toEqual([{ authorization: `Bearer ${ACCESS_TOKEN}` }])
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
