import { defineConfig } from '@playwright/test'

// E2E against the real SSR app. Critical paths only (§9). Requires a one-time
// `bunx playwright install` for browsers before the first run.
export default defineConfig({
  testDir: './e2e',
  // A stray `.only` would otherwise green CI while skipping every other test.
  forbidOnly: !!process.env['CI'],
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'bun run dev',
    port: 3000,
    reuseExistingServer: !process.env['CI'],
    // Placeholders, not credentials. The auth specs only exercise paths that stay
    // inside the BFF: building the authorize URL is pure string work, and the
    // callback specs are rejected on `state` before any WorkOS call is made.
    env: {
      WORKOS_API_KEY: 'sk_test_placeholder',
      WORKOS_CLIENT_ID: 'client_placeholder',
      WORKOS_COOKIE_PASSWORD: 'placeholder-cookie-password-32-chars',
      WORKOS_REDIRECT_URI: 'http://localhost:3000/auth/callback',
    },
  },
})
