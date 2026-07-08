import { defineConfig } from '@playwright/test'

// E2E against the real SSR app. Critical paths only (§9). Requires a one-time
// `bunx playwright install` for browsers before the first run.
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'bun run dev',
    port: 3000,
    reuseExistingServer: !process.env['CI'],
  },
})
