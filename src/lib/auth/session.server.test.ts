import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Both mocks sit on external boundaries: the Start server runtime holds its cookie
// helpers in request-scoped AsyncLocalStorage that has no equivalent under Vitest,
// and WorkOS is a third-party service. Nothing we own is mocked.
const mocks = vi.hoisted(() => ({
  getCookie: vi.fn<(name: string) => string | undefined>(),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
  // Undefined by default: most tests exercise one call, where request-scoped
  // memoization is irrelevant. The per-request tests point it at a real Request.
  getRequest: vi.fn<() => Request | undefined>(),
  loadSealedSession: vi.fn(),
  workosConstructor: vi.fn(),
}))

vi.mock('@tanstack/react-start/server', () => ({
  getCookie: mocks.getCookie,
  setCookie: mocks.setCookie,
  deleteCookie: mocks.deleteCookie,
  getRequest: mocks.getRequest,
}))

vi.mock('@workos-inc/node', () => ({
  WorkOS: class {
    userManagement = { loadSealedSession: mocks.loadSealedSession }
    constructor(apiKey: string, options: { clientId: string }) {
      mocks.workosConstructor(apiKey, options)
    }
  },
}))

const { SESSION_COOKIE_NAME, getSession, getWorkOS } = await import('./session.server')

const VALID_ENV = {
  WORKOS_API_KEY: 'sk_test_key',
  WORKOS_CLIENT_ID: 'client_123',
  WORKOS_COOKIE_PASSWORD: 'a'.repeat(32),
  WORKOS_REDIRECT_URI: 'http://localhost:3000/auth/callback',
} as const

const USER = { id: 'user_1', email: 'ada@example.com' }

let originalEnv: NodeJS.ProcessEnv

beforeEach(() => {
  originalEnv = { ...process.env }
  Object.assign(process.env, VALID_ENV)
})

afterEach(() => {
  process.env = originalEnv
  vi.clearAllMocks()
})

// The client is cached in module scope, which outlives any single test. Each test
// therefore primes the cache first and only then asserts on what follows.
describe('getWorkOS', () => {
  it('reuses one client across calls so the cached JWKS survives', () => {
    getWorkOS()
    mocks.workosConstructor.mockClear()

    getWorkOS()
    getWorkOS()

    expect(mocks.workosConstructor).not.toHaveBeenCalled()
  })

  it('builds a new client once the credentials are rotated', () => {
    getWorkOS()
    mocks.workosConstructor.mockClear()

    process.env['WORKOS_API_KEY'] = 'sk_test_rotated'
    getWorkOS()

    expect(mocks.workosConstructor).toHaveBeenCalledTimes(1)
    expect(mocks.workosConstructor).toHaveBeenLastCalledWith('sk_test_rotated', {
      clientId: 'client_123',
    })
  })
})

describe('getSession', () => {
  it('returns null for a visitor with no session cookie', async () => {
    mocks.getCookie.mockReturnValue(undefined)

    expect(await getSession()).toBeNull()
    expect(mocks.loadSealedSession).not.toHaveBeenCalled()
  })

  it('returns the access token and user for a valid session', async () => {
    mocks.getCookie.mockReturnValue('sealed-cookie')
    mocks.loadSealedSession.mockReturnValue({
      authenticate: vi.fn().mockResolvedValue({
        authenticated: true,
        accessToken: 'access-token',
        user: USER,
      }),
      refresh: vi.fn(),
    })

    expect(await getSession()).toEqual({ accessToken: 'access-token', user: USER })
    expect(mocks.setCookie).not.toHaveBeenCalled()
  })

  it('signs the visitor out instead of throwing when the cookie cannot be unsealed', async () => {
    // Regression: a tampered cookie, or one sealed with a since-rotated password,
    // makes `authenticate()` throw rather than return a structured failure. That
    // used to escape as a 500 on every request the visitor made.
    mocks.getCookie.mockReturnValue('tampered-cookie')
    mocks.loadSealedSession.mockReturnValue({
      authenticate: vi.fn().mockRejectedValue(new Error('Cannot decrypt sealed data')),
      refresh: vi.fn(),
    })

    expect(await getSession()).toBeNull()
    expect(mocks.deleteCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, expect.anything())
  })

  it('signs the visitor out instead of throwing when refreshing throws', async () => {
    mocks.getCookie.mockReturnValue('sealed-cookie')
    mocks.loadSealedSession.mockReturnValue({
      authenticate: vi.fn().mockResolvedValue({ authenticated: false, reason: 'invalid_jwt' }),
      refresh: vi.fn().mockRejectedValue(new Error('Cannot decrypt sealed data')),
    })

    expect(await getSession()).toBeNull()
    expect(mocks.deleteCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, expect.anything())
  })

  it('renews an expired access token and re-seals the cookie', async () => {
    mocks.getCookie.mockReturnValue('stale-cookie')
    mocks.loadSealedSession.mockReturnValue({
      authenticate: vi.fn().mockResolvedValue({ authenticated: false, reason: 'invalid_jwt' }),
      refresh: vi.fn().mockResolvedValue({
        authenticated: true,
        sealedSession: 'resealed-cookie',
        session: { accessToken: 'fresh-token' },
        user: USER,
      }),
    })

    expect(await getSession()).toEqual({ accessToken: 'fresh-token', user: USER })
    expect(mocks.setCookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      'resealed-cookie',
      expect.anything(),
    )
  })

  it('signs the visitor out when the refresh token is spent', async () => {
    mocks.getCookie.mockReturnValue('stale-cookie')
    mocks.loadSealedSession.mockReturnValue({
      authenticate: vi.fn().mockResolvedValue({ authenticated: false, reason: 'invalid_jwt' }),
      refresh: vi.fn().mockResolvedValue({ authenticated: false, reason: 'invalid_grant' }),
    })

    expect(await getSession()).toBeNull()
    expect(mocks.deleteCookie).toHaveBeenCalledWith(SESSION_COOKIE_NAME, expect.anything())
  })

  it('resolves the session once when several callers share one request', async () => {
    // Route loaders run in parallel, so one request can ask for the session more than
    // once. Each resolution of an expired token spends the single-use refresh token,
    // so a second concurrent resolution would sign the visitor out. Regression for that.
    mocks.getRequest.mockReturnValue(new Request('http://localhost:3000/profile'))
    mocks.getCookie.mockReturnValue('sealed-cookie')
    const authenticate = vi.fn().mockResolvedValue({
      authenticated: true,
      accessToken: 'access-token',
      user: USER,
    })
    mocks.loadSealedSession.mockReturnValue({ authenticate, refresh: vi.fn() })

    const [first, second] = await Promise.all([getSession(), getSession()])

    expect(first).toEqual({ accessToken: 'access-token', user: USER })
    expect(second).toBe(first)
    expect(authenticate).toHaveBeenCalledTimes(1)
  })

  it('resolves separately for distinct requests', async () => {
    // The memo is per request, never across them: two visitors' requests must not
    // share a session resolution.
    mocks.getCookie.mockReturnValue('sealed-cookie')
    const authenticate = vi.fn().mockResolvedValue({
      authenticated: true,
      accessToken: 'access-token',
      user: USER,
    })
    mocks.loadSealedSession.mockReturnValue({ authenticate, refresh: vi.fn() })

    mocks.getRequest.mockReturnValue(new Request('http://localhost:3000/'))
    await getSession()
    mocks.getRequest.mockReturnValue(new Request('http://localhost:3000/'))
    await getSession()

    expect(authenticate).toHaveBeenCalledTimes(2)
  })
})
