import { expect, test } from '@playwright/test'

// The whole point of this stack is SSR: the server ships real HTML, and the
// client bundle hydrates it. Component tests render in jsdom and never exercise
// either half, so these are the only tests that can catch SSR or hydration
// regressing.

test('server-renders the home page before any JavaScript runs', async ({ request }) => {
  // `request` is a bare HTTP client — it executes no JavaScript. Any markup we
  // see here therefore came from the server, which is exactly the claim we want
  // to pin down. If someone flipped this route to SPA mode, this would fail.
  const res = await request.get('/')

  expect(res.status()).toBe(200)
  expect(await res.text()).toContain('<h1')
})

test('hydrates the home page without errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`)
  })
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

  await page.goto('/')

  // TanStack Start exposes `window.$_TSR` while booting and deletes it once the
  // app has hydrated and the stream has ended. Waiting on its removal is a
  // deterministic hydration barrier — no arbitrary timeouts. If a future Start
  // upgrade renames this, that is what a timeout here means.
  await page.waitForFunction(() => !('$_TSR' in window))

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page).toHaveTitle('Fair n Square')
  expect(errors).toEqual([])
})
