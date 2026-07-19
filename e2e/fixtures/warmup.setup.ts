import { test } from '@playwright/test'
import { waitForHydration } from './hydration'

// Not a spec — a setup project every real project depends on (see
// playwright.config.ts).
//
// The e2e suite runs against `vite dev` (a production serving story is deferred to
// FNS-111). Vite's dev server discovers client dependencies during the first real
// page load and re-optimizes, 504ing in-flight module requests ("Outdated Optimize
// Dep") and force-reloading the page. On a cold CI runner that churn lands inside
// whichever spec happens to run first and fails it; on a warm local machine it never
// shows. Loading the app once here absorbs the churn so every spec starts against a
// settled server.
test('warm up the dev server', async ({ page }) => {
  // First visit triggers dependency discovery and possibly a mid-flight reload;
  // the second confirms the module graph is stable and hydration completes.
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.goto('/', { waitUntil: 'networkidle' })
  await waitForHydration(page)
})
