import { createFileRoute } from '@tanstack/react-router'
import { getRequest } from '@tanstack/react-start/server'
import { OauthException } from '@workos-inc/node'
import type { User } from '@workos-inc/node'
import { getWorkOSConfig } from '../lib/auth/config.server'
import { isSameOAuthState } from '../lib/auth/oauth-state'
import { getWorkOS, setSessionCookie, takeOAuthStateCookie } from '../lib/auth/session.server'
import { resolveUser } from '../lib/rpc/identity.server'
import { redirectResponse } from '../lib/http'

// Server-only: no `component`, so the client route tree never imports this file.
export const Route = createFileRoute('/auth/callback')({
  server: {
    handlers: {
      GET: async () => {
        const url = new URL(getRequest().url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')

        // Always consume the state cookie, even on the failure paths, so a
        // botched attempt can't be replayed against a still-live state.
        const expectedState = takeOAuthStateCookie()

        if (!code) {
          return new Response('Missing authorization code', { status: 400 })
        }
        if (!state || !expectedState || !isSameOAuthState(state, expectedState)) {
          return new Response('Invalid OAuth state', { status: 400 })
        }

        const { clientId, cookiePassword } = getWorkOSConfig()

        let sealedSession: string | undefined
        let accessToken: string
        let user: User
        try {
          ;({ sealedSession, accessToken, user } =
            await getWorkOS().userManagement.authenticateWithCode({
              code,
              clientId,
              session: { sealSession: true, cookiePassword },
            }))
        } catch (error) {
          // Authorization codes are single-use and short-lived, so WorkOS rejecting
          // one is ordinary: the visitor sat on the page, refreshed the callback, or
          // came back through history. Start the login over rather than show a 500.
          if (error instanceof OauthException) {
            return redirectResponse('/auth/login')
          }
          // Anything else — the network, a bad API key — is our problem, not theirs.
          throw error
        }

        if (!sealedSession) {
          throw new Error('WorkOS returned no sealed session for the authorization code')
        }

        // First login is where the canonical user record gets provisioned (ADR-4), so
        // this is the one request that must wait on the auth service — every later
        // request just carries the token. `created` (first login) and `found` (every
        // one after) are equally good outcomes; the call is idempotent.
        try {
          await resolveUser({ accessToken, email: user.email })
        } catch (error) {
          // The session is sealed but deliberately not set: a visitor holding a WorkOS
          // cookie with no canonical user behind it is half-authenticated, and every
          // downstream call would fail in ways much harder to read than this. Send them
          // back to a retry rather than into an app that cannot serve them.
          console.error('ResolveUser failed; refusing to establish the session', error)
          // No `Retry-After`: that invites a retry of *this* request, which cannot work.
          // The state cookie is spent and the authorization code is single-use, so the
          // only way forward is a fresh login — link them to one rather than imply the
          // callback is worth hitting again.
          return new Response(
            `<!doctype html><meta charset="utf-8"><title>Sign-in failed</title>` +
              `<p>We couldn't finish setting up your account. ` +
              `<a href="/auth/login">Please try signing in again.</a></p>`,
            { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } },
          )
        }

        setSessionCookie(sealedSession)
        return redirectResponse('/')
      },
    },
  },
})
