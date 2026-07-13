import { createFileRoute } from '@tanstack/react-router'
import { getRequest } from '@tanstack/react-start/server'
import { OauthException } from '@workos-inc/node'
import { getWorkOSConfig } from '../lib/auth/config.server'
import { isSameOAuthState } from '../lib/auth/oauth-state'
import { getWorkOS, setSessionCookie, takeOAuthStateCookie } from '../lib/auth/session.server'
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
        try {
          ;({ sealedSession } = await getWorkOS().userManagement.authenticateWithCode({
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

        setSessionCookie(sealedSession)
        return redirectResponse('/')
      },
    },
  },
})
