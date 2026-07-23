import { expect, test } from '@playwright/test'

// `/auth/login` is a server-only handler, so `request` (which runs no JavaScript) is
// exactly the right fixture: anything it observes came from the BFF.

test('GET /auth/login redirects to WorkOS and issues a state cookie', async ({ request }) => {
  const res = await request.get('/auth/login', { maxRedirects: 0 })

  expect(res.status()).toBe(302)

  const location = res.headers()['location'] ?? ''
  expect(location).not.toBe('')

  const authorizeUrl = new URL(location)
  expect(authorizeUrl.host).toBe('api.workos.com')
  // `authkit` is WorkOS's hosted login screen (passkeys, email, and every enabled
  // social provider) — naming a single provider here would skip that screen.
  expect(authorizeUrl.searchParams.get('provider')).toBe('authkit')
  expect(authorizeUrl.searchParams.get('redirect_uri')).toBe('http://localhost:3000/auth/callback')

  const state = authorizeUrl.searchParams.get('state') ?? ''
  expect(state).not.toBe('')

  // The same state must come back as an httpOnly cookie so the callback can match it.
  const setCookie = res.headers()['set-cookie'] ?? ''
  expect(setCookie).toContain('fns_oauth_state=')
  expect(setCookie).toContain('HttpOnly')
  expect(setCookie).toContain(encodeURIComponent(state))
})
