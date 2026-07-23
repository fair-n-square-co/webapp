import { expect, test } from '@playwright/test'

// Logout is a POST-only server handler (a GET would be CSRF-able).

test('POST /auth/logout clears the session and redirects home', async ({ request }) => {
  const res = await request.post('/auth/logout', { maxRedirects: 0 })

  expect(res.status()).toBe(302)
  expect(res.headers()['location']).toBe('/')
})
