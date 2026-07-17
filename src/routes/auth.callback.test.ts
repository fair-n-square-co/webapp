import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OauthException } from '@workos-inc/node'
import type * as WorkOSModule from '@workos-inc/node'
import { ResolveUserResponse_Resolution } from '@fair-n-square-co/apis/fairnsquare/service/authx/v1alpha1/authx_api_pb'
import { server } from '../test/msw/server'
import { TEST_AUTH_SERVICE_BASE_URL } from '../test/msw/auth-service'
import {
  STALL_MS,
  resolveUserHandler,
  type RecordedResolveUser,
  type ResolveUserOutcome,
} from '../test/msw/identity'

// External boundaries only: the Start server runtime (request-scoped cookie and
// request helpers, which have no Vitest equivalent) and the WorkOS service.
const mocks = vi.hoisted(() => ({
  getRequest: vi.fn<() => Request>(),
  getCookie: vi.fn<(name: string) => string | undefined>(),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
  authenticateWithCode: vi.fn(),
  loadSealedSession: vi.fn(),
  getLogoutUrl: vi.fn(),
}))

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: mocks.getRequest,
  getCookie: mocks.getCookie,
  setCookie: mocks.setCookie,
  deleteCookie: mocks.deleteCookie,
}))

vi.mock('@workos-inc/node', async (importOriginal) => {
  // Keep the real OauthException: the route narrows on it with `instanceof`.
  const actual = await importOriginal<typeof WorkOSModule>()
  return {
    ...actual,
    WorkOS: class {
      userManagement = {
        authenticateWithCode: mocks.authenticateWithCode,
        loadSealedSession: mocks.loadSealedSession,
      }
    },
  }
})

const { Route } = await import('./auth.callback')

const VALID_ENV = {
  WORKOS_API_KEY: 'sk_test_key',
  WORKOS_CLIENT_ID: 'client_123',
  WORKOS_COOKIE_PASSWORD: 'a'.repeat(32),
  WORKOS_REDIRECT_URI: 'http://localhost:3000/auth/callback',
  AUTH_SERVICE_BASE_URL: TEST_AUTH_SERVICE_BASE_URL,
} as const

const STATE = 'the-issued-state'
const ACCESS_TOKEN = 'workos-access-token'
const EMAIL = 'ada@example.com'
const WORKOS_LOGOUT_URL =
  'https://api.workos.test/user_management/sessions/logout?session_id=sess_1'

/** Pull the bare GET handler off the route definition. */
function getHandler(): () => Promise<Response> {
  const handlers = Route.options.server?.handlers
  if (!handlers || typeof handlers === 'function' || !handlers.GET) {
    throw new Error('expected an object of handlers with a GET entry')
  }
  const { GET } = handlers
  if (typeof GET !== 'function') {
    throw new Error('expected GET to be a bare handler function')
  }
  // The declared handler type is a union covering the framework's middleware form and
  // a context argument this handler ignores. The guards above have already pinned it
  // to the bare function; the assertion only drops parameters we never pass.
  return GET as () => Promise<Response>
}

function arriveAtCallback(search: string): void {
  mocks.getRequest.mockReturnValue(new Request(`http://localhost:3000/auth/callback${search}`))
}

/** A successful code exchange: WorkOS returns the sealed session, the token and the user. */
function workOSAcceptsTheCode(): void {
  mocks.authenticateWithCode.mockResolvedValue({
    sealedSession: 'sealed-cookie',
    accessToken: ACCESS_TOKEN,
    user: { email: EMAIL },
  })
}

let originalEnv: NodeJS.ProcessEnv
let resolveUserCalls: RecordedResolveUser[]

/** Point the auth service at an outcome; every call it receives lands in `resolveUserCalls`. */
function authServiceAnswers(outcome: ResolveUserOutcome): void {
  server.use(resolveUserHandler(outcome, resolveUserCalls))
}

beforeEach(() => {
  originalEnv = { ...process.env }
  Object.assign(process.env, VALID_ENV)
  mocks.getCookie.mockReturnValue(STATE)
  // On a provisioning failure the callback ends the WorkOS session; by default that
  // yields a logout URL. Individual tests override `getLogoutUrl` to force the failure.
  mocks.loadSealedSession.mockReturnValue({ getLogoutUrl: mocks.getLogoutUrl })
  mocks.getLogoutUrl.mockResolvedValue(WORKOS_LOGOUT_URL)
  resolveUserCalls = []
})

afterEach(() => {
  process.env = originalEnv
  vi.clearAllMocks()
  // Not just `clearAllMocks`: the failure tests silence `console.error` with a spy, and
  // clearing a spy leaves that silent implementation in place. A later test's unexpected
  // error would then vanish instead of being printed.
  vi.restoreAllMocks()
})

describe('GET /auth/callback', () => {
  it('seals the session and sends the user home on a good code', async () => {
    arriveAtCallback(`?code=good_code&state=${STATE}`)
    workOSAcceptsTheCode()
    authServiceAnswers({ kind: 'resolved', resolution: ResolveUserResponse_Resolution.CREATED })

    const res = await getHandler()()

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/')
    expect(mocks.setCookie).toHaveBeenCalledWith('fns_session', 'sealed-cookie', expect.anything())
  })

  it('provisions the canonical user once, with the token in metadata and the email in the body', async () => {
    // ADR-4 zero trust: the auth service derives issuer/subject from the token it can
    // verify, so the email is the only thing it will take our word for.
    arriveAtCallback(`?code=good_code&state=${STATE}`)
    workOSAcceptsTheCode()
    authServiceAnswers({ kind: 'resolved', resolution: ResolveUserResponse_Resolution.CREATED })

    await getHandler()()

    expect(resolveUserCalls).toEqual([{ email: EMAIL, authorization: `Bearer ${ACCESS_TOKEN}` }])
  })

  it('signs in an already-provisioned user without creating a second record', async () => {
    // Every login after the first: same identity, same canonical user, no duplicate.
    arriveAtCallback(`?code=good_code&state=${STATE}`)
    workOSAcceptsTheCode()
    authServiceAnswers({ kind: 'resolved', resolution: ResolveUserResponse_Resolution.FOUND })

    const res = await getHandler()()

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/')
    expect(mocks.setCookie).toHaveBeenCalledWith('fns_session', 'sealed-cookie', expect.anything())
    expect(resolveUserCalls).toHaveLength(1)
  })

  it('does not establish a session when provisioning fails', async () => {
    // A WorkOS cookie with no canonical user behind it is half-authenticated: every
    // downstream call would fail. Better to hand back a retry than a broken session.
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    arriveAtCallback(`?code=good_code&state=${STATE}`)
    workOSAcceptsTheCode()
    authServiceAnswers({ kind: 'unavailable' })

    const res = await getHandler()()

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(WORKOS_LOGOUT_URL)
    expect(mocks.setCookie).not.toHaveBeenCalled()
    expect(logged).toHaveBeenCalled()
  })

  it('ends the WorkOS session so the retry is not silently looped', async () => {
    // Leaving the WorkOS SSO cookie alive would re-authenticate the same identity on the
    // next attempt with no account picker — the exact loop we are avoiding. So the failure
    // routes through WorkOS logout, returning to the in-app failure page afterward.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    arriveAtCallback(`?code=good_code&state=${STATE}`)
    workOSAcceptsTheCode()
    authServiceAnswers({ kind: 'unavailable' })

    const res = await getHandler()()

    expect(mocks.getLogoutUrl).toHaveBeenCalledWith({
      returnTo: 'http://localhost:3000/signin-failed',
    })
    expect(res.headers.get('location')).toBe(WORKOS_LOGOUT_URL)
    // No `Retry-After`: that would invite a retry of this single-use callback.
    expect(res.headers.get('retry-after')).toBeNull()
  })

  it('falls back to the in-app failure page when the WorkOS logout URL cannot be built', async () => {
    // An expired or unreachable session can't produce a logout URL. We still refuse the
    // session and still land the visitor on the failure page rather than erroring.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.getLogoutUrl.mockRejectedValue(new Error('session expired'))
    arriveAtCallback(`?code=good_code&state=${STATE}`)
    workOSAcceptsTheCode()
    authServiceAnswers({ kind: 'unavailable' })

    const res = await getHandler()()

    expect(res.headers.get('location')).toBe('/signin-failed')
    expect(mocks.setCookie).not.toHaveBeenCalled()
  })

  it('gives up on an auth service that stalls rather than hanging the login', async () => {
    // Without a deadline the callback would wait on a stalled service indefinitely, holding
    // the request open with it.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env['AUTH_SERVICE_TIMEOUT_MS'] = String(Math.floor(STALL_MS / 4))
    arriveAtCallback(`?code=good_code&state=${STATE}`)
    workOSAcceptsTheCode()
    authServiceAnswers({ kind: 'stalls' })

    const res = await getHandler()()

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(WORKOS_LOGOUT_URL)
    expect(mocks.setCookie).not.toHaveBeenCalled()
  })

  it('does not establish a session when the canonical user has no email', async () => {
    // `email` is as load-bearing as `id` and just as optional on the wire.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    arriveAtCallback(`?code=good_code&state=${STATE}`)
    workOSAcceptsTheCode()
    authServiceAnswers({ kind: 'userWithoutEmail' })

    const res = await getHandler()()

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(WORKOS_LOGOUT_URL)
    expect(mocks.setCookie).not.toHaveBeenCalled()
  })

  it('does not establish a session when the auth service answers without a user', async () => {
    // `user` is an optional message and `resolution` an open enum, so an empty answer
    // decodes perfectly well into one that means nothing. It must not sign anyone in.
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    arriveAtCallback(`?code=good_code&state=${STATE}`)
    workOSAcceptsTheCode()
    authServiceAnswers({ kind: 'incomplete' })

    const res = await getHandler()()

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(WORKOS_LOGOUT_URL)
    expect(mocks.setCookie).not.toHaveBeenCalled()
    expect(logged).toHaveBeenCalled()
  })

  it('restarts the login when WorkOS rejects the code', async () => {
    // Regression: authorization codes are single-use and short-lived, so this is an
    // ordinary outcome (refresh, back button, a slow user). It used to be a 500.
    arriveAtCallback(`?code=expired_code&state=${STATE}`)
    mocks.authenticateWithCode.mockRejectedValue(
      new OauthException(400, 'req_1', 'invalid_grant', 'The code has expired.', {}),
    )

    const res = await getHandler()()

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/auth/login')
    expect(mocks.setCookie).not.toHaveBeenCalled()
  })

  it('does not swallow an unexpected failure as a redirect', async () => {
    // A network blip or a bad API key is our bug, not the visitor's. Surfacing it
    // beats bouncing them between login and callback forever.
    arriveAtCallback(`?code=good_code&state=${STATE}`)
    mocks.authenticateWithCode.mockRejectedValue(new Error('socket hang up'))

    await expect(getHandler()()).rejects.toThrow('socket hang up')
    expect(mocks.setCookie).not.toHaveBeenCalled()
  })

  it('rejects a callback with no authorization code', async () => {
    arriveAtCallback(`?state=${STATE}`)

    const res = await getHandler()()

    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Missing authorization code')
    expect(mocks.authenticateWithCode).not.toHaveBeenCalled()
  })

  it('rejects a forged state before ever contacting WorkOS', async () => {
    arriveAtCallback('?code=attacker_code&state=forged')

    const res = await getHandler()()

    expect(res.status).toBe(400)
    expect(await res.text()).toContain('Invalid OAuth state')
    expect(mocks.authenticateWithCode).not.toHaveBeenCalled()
  })
})
