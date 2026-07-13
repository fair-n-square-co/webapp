import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OauthException } from '@workos-inc/node'
import type * as WorkOSModule from '@workos-inc/node'

// External boundaries only: the Start server runtime (request-scoped cookie and
// request helpers, which have no Vitest equivalent) and the WorkOS service.
const mocks = vi.hoisted(() => ({
  getRequest: vi.fn<() => Request>(),
  getCookie: vi.fn<(name: string) => string | undefined>(),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
  authenticateWithCode: vi.fn(),
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
      userManagement = { authenticateWithCode: mocks.authenticateWithCode }
    },
  }
})

const { Route } = await import('./auth.callback')

const VALID_ENV = {
  WORKOS_API_KEY: 'sk_test_key',
  WORKOS_CLIENT_ID: 'client_123',
  WORKOS_COOKIE_PASSWORD: 'a'.repeat(32),
  WORKOS_REDIRECT_URI: 'http://localhost:3000/auth/callback',
} as const

const STATE = 'the-issued-state'

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

let originalEnv: NodeJS.ProcessEnv

beforeEach(() => {
  originalEnv = { ...process.env }
  Object.assign(process.env, VALID_ENV)
  mocks.getCookie.mockReturnValue(STATE)
})

afterEach(() => {
  process.env = originalEnv
  vi.clearAllMocks()
})

describe('GET /auth/callback', () => {
  it('seals the session and sends the user home on a good code', async () => {
    arriveAtCallback(`?code=good_code&state=${STATE}`)
    mocks.authenticateWithCode.mockResolvedValue({ sealedSession: 'sealed-cookie' })

    const res = await getHandler()()

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/')
    expect(mocks.setCookie).toHaveBeenCalledWith('fns_session', 'sealed-cookie', expect.anything())
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
