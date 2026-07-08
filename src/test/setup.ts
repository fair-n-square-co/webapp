import { afterAll, afterEach, beforeAll } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { server } from './msw/server'

// Mock at the network boundary (§9). Fail on any unhandled request so tests
// can't silently hit the real network — add handlers per test instead.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
