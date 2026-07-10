import { expect, test } from '@playwright/test'

// The auth routes are server-only handlers, so `request` (which runs no JavaScript)
// is exactly the right fixture: anything it observes came from the BFF.

test('GET /auth/login redirects to WorkOS and issues a state cookie', async ({ request }) => {
  const res = await request.get('/auth/login', { maxRedirects: 0 })

  expect(res.status()).toBe(302)

  const location = res.headers()['location'] ?? ''
  expect(location).not.toBe('')

  const authorizeUrl = new URL(location)
  expect(authorizeUrl.host).toBe('api.workos.com')
  expect(authorizeUrl.searchParams.get('provider')).toBe('GoogleOAuth')
  expect(authorizeUrl.searchParams.get('redirect_uri')).toBe('http://localhost:3000/auth/callback')

  const state = authorizeUrl.searchParams.get('state') ?? ''
  expect(state).not.toBe('')

  // The same state must come back as an httpOnly cookie so the callback can match it.
  const setCookie = res.headers()['set-cookie'] ?? ''
  expect(setCookie).toContain('fns_oauth_state=')
  expect(setCookie).toContain('HttpOnly')
  expect(setCookie).toContain(encodeURIComponent(state))
})

test('GET /auth/callback rejects a request with no authorization code', async ({ request }) => {
  const res = await request.get('/auth/callback', { maxRedirects: 0 })

  expect(res.status()).toBe(400)
  expect(await res.text()).toContain('Missing authorization code')
})

test('GET /auth/callback rejects a code with no matching state cookie', async ({ request }) => {
  // This is the CSRF case: an attacker hands the victim a callback URL bearing
  // the attacker's own code. With no state cookie from a login we started, it fails.
  const res = await request.get('/auth/callback?code=attacker_code&state=forged', {
    maxRedirects: 0,
  })

  expect(res.status()).toBe(400)
  expect(await res.text()).toContain('Invalid OAuth state')
})

test('GET /auth/callback rejects a state that does not match the issued cookie', async ({
  request,
}) => {
  // Start a real login so the browser holds a genuine state cookie...
  await request.get('/auth/login', { maxRedirects: 0 })

  // ...then come back with a different state than the one that was issued.
  const res = await request.get('/auth/callback?code=some_code&state=not-the-issued-state', {
    maxRedirects: 0,
  })

  expect(res.status()).toBe(400)
  expect(await res.text()).toContain('Invalid OAuth state')
})

test('POST /auth/logout clears the session and redirects home', async ({ request }) => {
  const res = await request.post('/auth/logout', { maxRedirects: 0 })

  expect(res.status()).toBe(302)
  expect(res.headers()['location']).toBe('/')
})
