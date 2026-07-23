import { expect, test } from '@playwright/test'
import { waitForHydration } from '../../fixtures/hydration'

// Unknown URLs render the NotFound screen at the root boundary, wrapped in its own
// app shell so the visitor is never stranded on a bare error page.

test('answers an unknown URL with a 404 and a real page', async ({ request }) => {
  const res = await request.get('/this-page-does-not-exist')

  expect(res.status()).toBe(404)
  expect(await res.text()).toContain('Page not found')
})

test('keeps exactly one app shell around the not-found screen', async ({ page }) => {
  // Regression sibling of ErrorScreen.test.tsx: screens that bring their own shell
  // must never end up nested inside another one.
  await page.goto('/this-page-does-not-exist')

  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expect(page.locator('.sidebar')).toHaveCount(1)
  await expect(page.locator('.bottomnav')).toHaveCount(1)
})

test('leads back home', async ({ page }) => {
  await page.goto('/this-page-does-not-exist')
  // The link is a router <Link>; click after hydration so it stays a client nav.
  await waitForHydration(page)

  await page.getByRole('link', { name: 'Back to home' }).click()

  await expect(page.getByRole('heading', { level: 1, name: /fair.*square/i })).toBeVisible()
  await expect(page).toHaveURL('/')
})
