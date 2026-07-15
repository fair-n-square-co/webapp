import { expect, test } from '@playwright/test'

// `/profile` is the repo's first session-gated screen. A logged-in render needs a
// real WorkOS session and a live profile service, neither of which the hermetic e2e
// env has (see playwright.config.ts) — that path is covered by the component tests
// and the wire-level BFF test. What these specs pin down is the half that runs with
// no backend and is the security-critical one: the server gate and its redirect, and
// that the gate fires on the server before any profile markup is produced.

test('redirects an anonymous visitor to login before rendering the profile', async ({
  request,
}) => {
  // `request` runs no JavaScript, so the redirect it sees is the server's own: the
  // loader's requireSession() unwinding into a redirect during SSR. TanStack Router
  // emits a 307 for a GET redirect.
  const res = await request.get('/profile', { maxRedirects: 0 })

  expect(res.status()).toBe(307)
  expect(res.headers()['location']).toBe('/auth/login')
})

test('leaks no profile content in the redirect response', async ({ request }) => {
  // The gated screen must not render at all for an anonymous visitor. Assert on the
  // redirect response itself (no following it out to the external login) so the test
  // stays hermetic.
  const res = await request.get('/profile', { maxRedirects: 0 })

  expect(await res.text()).not.toContain('Your account.')
})
