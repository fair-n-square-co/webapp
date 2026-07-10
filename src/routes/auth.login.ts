import { createFileRoute } from '@tanstack/react-router'
import { getWorkOSConfig } from '../lib/auth/config.server'
import { createOAuthState } from '../lib/auth/oauth-state'
import { getWorkOS, setOAuthStateCookie } from '../lib/auth/session.server'
import { redirectResponse } from '../lib/http'

// Server-only: no `component`, so the client route tree never imports this file.
export const Route = createFileRoute('/auth/login')({
  server: {
    handlers: {
      GET: () => {
        const { clientId, redirectUri } = getWorkOSConfig()

        const state = createOAuthState()
        setOAuthStateCookie(state)

        const authorizationUrl = getWorkOS().userManagement.getAuthorizationUrl({
          provider: 'GoogleOAuth',
          clientId,
          redirectUri,
          state,
        })

        return redirectResponse(authorizationUrl)
      },
    },
  },
})
