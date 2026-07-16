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

        // `authkit` renders WorkOS's hosted login UI, which offers passkeys, email,
        // and any social providers enabled in the dashboard. Naming a specific
        // provider (e.g. `GoogleOAuth`) would skip that screen and jump straight to
        // Google, so passkeys would never be offered.
        const authorizationUrl = getWorkOS().userManagement.getAuthorizationUrl({
          provider: 'authkit',
          clientId,
          redirectUri,
          state,
        })

        return redirectResponse(authorizationUrl)
      },
    },
  },
})
