import { WorkOS } from '@workos-inc/node'
import type { User } from '@workos-inc/node'
import { redirect } from '@tanstack/react-router'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { getWorkOSConfig } from './config.server'

/**
 * The BFF's half of the WorkOS session (ADR-4/ADR-5).
 *
 * The browser only ever holds an opaque, sealed, httpOnly cookie. Unsealing it —
 * and therefore the WorkOS access token forwarded to the Go services — happens
 * exclusively here on the server.
 */

export const SESSION_COOKIE_NAME = 'fns_session'
export const OAUTH_STATE_COOKIE_NAME = 'fns_oauth_state'

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10

/** A verified session. `accessToken` is what gets forwarded to the Go services. */
export type Session = Readonly<{
  accessToken: string
  user: User
}>

let cached: { credentials: string; client: WorkOS } | undefined

/**
 * The client is reused rather than rebuilt per request because each instance
 * caches the WorkOS JWKS used to verify access tokens. It is keyed on the
 * credentials so that rotating them takes effect on the next request.
 */
export function getWorkOS(): WorkOS {
  const { apiKey, clientId } = getWorkOSConfig()
  const credentials = `${apiKey}:${clientId}`

  if (cached?.credentials !== credentials) {
    cached = { credentials, client: new WorkOS(apiKey, { clientId }) }
  }
  return cached.client
}

// `secure` would make the cookie undeliverable over plain-HTTP localhost, where
// the OAuth callback lands during development.
const isProduction = (): boolean => process.env['NODE_ENV'] === 'production'

const baseCookieOptions = () =>
  ({
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax',
    path: '/',
  }) as const

export function setSessionCookie(sealedSession: string): void {
  setCookie(SESSION_COOKIE_NAME, sealedSession, {
    ...baseCookieOptions(),
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export function clearSessionCookie(): void {
  deleteCookie(SESSION_COOKIE_NAME, baseCookieOptions())
}

export function setOAuthStateCookie(state: string): void {
  setCookie(OAUTH_STATE_COOKIE_NAME, state, {
    ...baseCookieOptions(),
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  })
}

export function takeOAuthStateCookie(): string | undefined {
  const state = getCookie(OAUTH_STATE_COOKIE_NAME)
  deleteCookie(OAUTH_STATE_COOKIE_NAME, baseCookieOptions())
  return state
}

/**
 * Resolve the current session, or `null` if the caller is not signed in.
 *
 * WorkOS access tokens expire after a few minutes, so an unauthenticated result
 * is retried once through the refresh token before giving up. A successful
 * refresh re-seals the cookie, which is why this can mutate the response.
 */
export async function getSession(): Promise<Session | null> {
  const sessionData = getCookie(SESSION_COOKIE_NAME)
  if (!sessionData) {
    return null
  }

  const { cookiePassword } = getWorkOSConfig()
  const sealed = getWorkOS().userManagement.loadSealedSession({
    sessionData,
    cookiePassword,
  })

  try {
    const authenticated = await sealed.authenticate()
    if (authenticated.authenticated) {
      return { accessToken: authenticated.accessToken, user: authenticated.user }
    }

    const refreshed = await sealed.refresh({ cookiePassword })
    if (!refreshed.authenticated || !refreshed.sealedSession || !refreshed.session) {
      clearSessionCookie()
      return null
    }

    setSessionCookie(refreshed.sealedSession)
    return { accessToken: refreshed.session.accessToken, user: refreshed.user }
  } catch {
    // Unsealing throws outright on a tampered cookie, or on one sealed with a
    // since-rotated password — unlike every other failure here, which comes back
    // as a structured result. A visitor holding an unreadable cookie is simply
    // not signed in; discard it rather than serving them a 500 forever.
    clearSessionCookie()
    return null
  }
}

/**
 * Build a WorkOS logout URL for an already-sealed session, or `null` if one can't be
 * produced (an expired or tampered session, or WorkOS being unreachable). Sending the
 * browser through this is how the *WorkOS* session ends — without it, WorkOS's own SSO
 * cookie would silently re-authenticate the same identity on the next login. `returnTo`
 * is where WorkOS returns afterward; it must be allow-listed as a sign-out redirect in
 * the WorkOS dashboard, otherwise WorkOS falls back to the configured App homepage.
 */
export async function getWorkOSLogoutUrl({
  sessionData,
  returnTo,
}: Readonly<{ sessionData: string; returnTo?: string }>): Promise<string | null> {
  try {
    const { cookiePassword } = getWorkOSConfig()
    const sealed = getWorkOS().userManagement.loadSealedSession({ sessionData, cookiePassword })
    return await sealed.getLogoutUrl(returnTo ? { returnTo } : {})
  } catch {
    return null
  }
}

/** Same as {@link getSession}, but redirects anonymous callers to the login route. */
export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) {
    // `/auth/login` is a server-only route (a GET handler that 302s to WorkOS, no
    // client component). `reloadDocument` forces a full-page navigation so the
    // browser hits that handler; a client-side redirect would resolve to a route
    // with nothing to render and fall through to the router's NotFound. On the SSR
    // path this is already emitted as a real 307, so `reloadDocument` is a no-op there.
    throw redirect({ href: '/auth/login', reloadDocument: true })
  }
  return session
}
