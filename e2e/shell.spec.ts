import { expect, test } from '@playwright/test'
import { waitForHydration } from './support'

// The app shell: sidebar navigation and its log in/out corner. The signed-in state
// needs a real WorkOS session, which the hermetic e2e env has no way to mint — that
// half is covered by AppShell.test.tsx. What e2e pins down is the anonymous half and
// the navigation the shell exists for.

test('server-renders the sidebar log-in affordance for an anonymous visitor', async ({
  request,
}) => {
  // `request` runs no JavaScript, so the account area it sees was in the server's
  // HTML — the shell's auth state does not pop in after hydration.
  const res = await request.get('/')

  expect(res.status()).toBe(200)
  const html = await res.text()
  expect(html).toContain('class="account"')
  expect(html).toContain('href="/auth/login"')
})

test('shows the log-in button in the sidebar and no log-out while anonymous', async ({ page }) => {
  await page.goto('/')

  const sidebar = page.locator('.sidebar')
  await expect(sidebar.getByRole('link', { name: 'Log in' })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Log out' })).toHaveCount(0)
})

test('sends an anonymous visitor into the login flow when they open Profile', async ({ page }) => {
  // The client-side gate in one journey: a client navigation to /profile runs the
  // loader, the session gate rejects with a redirect (not retried — that regression
  // made this take seconds), and the browser does a full navigation to /auth/login.
  // That route is stubbed so the test never follows its 302 out to WorkOS — the
  // redirect-to-WorkOS half is covered by auth.spec.ts at the request level.
  await page.route('**/auth/login', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html><body>login-stub</body></html>' }),
  )
  // Safety net: a pre-hydration click would document-navigate to /profile and follow
  // the server's redirect chain out to real WorkOS (a redirect hop never re-enters
  // page.route). Abort at the host so any such regression fails fast and hermetically.
  await page.route(
    (url) => url.hostname.endsWith('workos.com'),
    (route) => route.abort(),
  )

  await page.goto('/')
  // The click must be a client-side navigation — that is the path under test.
  await waitForHydration(page)
  await page.locator('.sidebar').getByRole('link', { name: 'Profile' }).click()

  await expect(page).toHaveURL(/\/auth\/login$/)
})

test('keeps the sidebar navigation on every screen', async ({ page }) => {
  await page.goto('/signin-failed')

  const sidebar = page.locator('.sidebar')
  await expect(sidebar.getByRole('link', { name: 'Home' })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Profile' })).toBeVisible()
})
