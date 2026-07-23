import { expect, test } from '@playwright/test'

// The OAuth callback's rejection paths. Each of these is refused inside the BFF
// before any WorkOS call is made, which is what keeps them hermetic.

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
