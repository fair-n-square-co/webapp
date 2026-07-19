import type { Page } from '@playwright/test'

/**
 * Wait until the client bundle has hydrated the server's HTML.
 *
 * TanStack Start exposes `window.$_TSR` while booting and deletes it once the app
 * has hydrated and the stream has ended, so waiting on its removal is a
 * deterministic hydration barrier — no arbitrary timeouts. If a future Start
 * upgrade renames this, that is what a timeout here means.
 *
 * Any test that clicks a router `<Link>` must wait for this first: before
 * hydration the link is a plain anchor, and the click becomes a full document
 * navigation instead of the client-side routing the test means to exercise.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => !('$_TSR' in window))
}
