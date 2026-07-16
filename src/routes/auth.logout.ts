import { createFileRoute } from '@tanstack/react-router'
import { getCookie } from '@tanstack/react-start/server'
import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  getWorkOSLogoutUrl,
} from '../lib/auth/session.server'
import { redirectResponse } from '../lib/http'

// POST rather than GET: a GET logout is trivially CSRF-able, and link prefetchers
// and mail scanners would sign people out just by following the URL.
// Server-only: no `component`, so the client route tree never imports this file.
export const Route = createFileRoute('/auth/logout')({
  server: {
    handlers: {
      POST: async () => {
        const sessionData = getCookie(SESSION_COOKIE_NAME)

        // Drop our cookie first: whatever WorkOS says next, this browser is signed out.
        clearSessionCookie()

        if (!sessionData) {
          return redirectResponse('/')
        }

        // An expired or tampered cookie can't produce a logout URL. The local
        // cookie is already gone, so finishing at '/' is the correct outcome.
        const logoutUrl = await getWorkOSLogoutUrl({ sessionData })
        return redirectResponse(logoutUrl ?? '/')
      },
    },
  },
})
