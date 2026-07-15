import { afterAll, afterEach, beforeAll } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { server } from './msw/server'

// Mock at the network boundary (§9). Fail on any unhandled request so tests
// can't silently hit the real network — add handlers per test instead.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  // Vitest isn't in `globals` mode, so React Testing Library's automatic teardown
  // never registers. Unmount by hand, or rendered DOM piles up across tests in a
  // file and queries start matching stale nodes from earlier renders.
  cleanup()
})
afterAll(() => server.close())
