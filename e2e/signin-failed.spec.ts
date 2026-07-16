import { expect, test } from '@playwright/test'

// The page the OAuth callback lands on when it authenticates a visitor but cannot
// provision their user. The failure path itself needs a live WorkOS exchange, so it
// is covered at the unit level (auth.callback.test.ts); what e2e pins down is that
// the destination exists, server-renders, and offers the retry.

test('server-renders the sign-in failure page', async ({ request }) => {
  const res = await request.get('/signin-failed')

  expect(res.status()).toBe(200)
  const html = await res.text()
  expect(html).toContain('finish signing you in')
  expect(html).toContain('href="/auth/login"')
})

test('offers a fresh login attempt', async ({ page }) => {
  await page.goto('/signin-failed')

  await expect(
    page.getByRole('heading', { level: 1, name: /couldn’t finish signing you in/i }),
  ).toBeVisible()

  // A plain anchor to the server-only login route — a full-page navigation.
  const retry = page.getByRole('link', { name: 'Try signing in again' })
  await expect(retry).toBeVisible()
  await expect(retry).toHaveAttribute('href', '/auth/login')
})
