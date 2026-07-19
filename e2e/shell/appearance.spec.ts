import { expect, test } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'
import { waitForHydration } from '../fixtures/hydration'

// Appearance is stamped in `__root.tsx`, so it is chrome on every screen rather than
// one screen's concern. The whole design exists to avoid a light-to-dark flash, and
// that is a claim only e2e can check: jsdom neither server-renders nor paints. The
// segmented System/Light/Dark control itself lives on the session-gated profile
// screen and is unreachable here — see e2e/README.md.

/** Ask for `/` as a browser holding the given appearance cookie, running no JavaScript. */
async function serverHtmlWithThemeCookie(
  request: APIRequestContext,
  cookie: string | null,
): Promise<string> {
  const res = await request.get('/', {
    headers: cookie === null ? {} : { cookie },
    maxRedirects: 0,
  })
  expect(res.status()).toBe(200)
  return res.text()
}

test.describe('server-stamped theme', () => {
  test('stamps dark on the document for an explicit dark preference', async ({ request }) => {
    // `request` runs no JavaScript, so this attribute was in the server's HTML — the
    // theme is correct in the first byte, not corrected after hydration.
    const html = await serverHtmlWithThemeCookie(request, 'fns_theme=dark')

    expect(html).toContain('data-theme="dark"')
  })

  test('stamps light for an explicit light preference', async ({ request }) => {
    const html = await serverHtmlWithThemeCookie(request, 'fns_theme=light')

    expect(html).toContain('data-theme="light"')
  })

  test('stamps light for a system preference, which the server cannot resolve', async ({
    request,
  }) => {
    // The server cannot read `prefers-color-scheme`, so `system` renders light and the
    // pre-paint script corrects a dark device. Pinning this documents why that script
    // has to exist at all.
    const html = await serverHtmlWithThemeCookie(request, 'fns_theme=system')

    expect(html).toContain('data-theme="light"')
  })

  test('stamps light when no appearance cookie is present', async ({ request }) => {
    const html = await serverHtmlWithThemeCookie(request, null)

    expect(html).toContain('data-theme="light"')
  })

  test('still renders when the appearance cookie is malformed', async ({ request }) => {
    // '%2' is a truncated percent-escape. The server must treat an undecodable
    // preference as "system" rather than letting it fault the whole document.
    const html = await serverHtmlWithThemeCookie(request, 'fns_theme=%2')

    expect(html).toContain('data-theme="light"')
    expect(html).toContain('<h1')
  })

  test('inlines the correction script ahead of any rendered content', async ({ request }) => {
    // The script only prevents a flash if it runs before first paint, which means it
    // must appear in <head>, ahead of <body>. Order is the whole guarantee.
    const html = await serverHtmlWithThemeCookie(request, 'fns_theme=system')

    const scriptAt = html.indexOf('prefers-color-scheme')
    const bodyAt = html.indexOf('<body')
    expect(scriptAt).toBeGreaterThan(-1)
    expect(scriptAt).toBeLessThan(bodyAt)
  })
})

test.describe('pre-paint correction on a dark device', () => {
  test.use({ colorScheme: 'dark' })

  test('corrects a system visitor to dark without a flash', async ({ page }) => {
    // The server stamped light (it cannot see the media query); the inline script must
    // have already flipped it to dark by the time anything is painted.
    await page.goto('/')

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('leaves an explicit light preference alone on a dark device', async ({ page }) => {
    // An explicit choice must beat the device preference, or the control would appear
    // to do nothing for anyone whose OS disagrees with it.
    await page
      .context()
      .addCookies([{ name: 'fns_theme', value: 'light', url: 'http://localhost:3000' }])

    await page.goto('/')
    await waitForHydration(page)

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })
})
