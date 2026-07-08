import type { RequestHandler } from 'msw'

// Default handlers shared across tests. The scaffold makes no requests yet;
// add BFF/API handlers here as endpoints appear, or override per-test with
// `server.use(...)`.
export const handlers: RequestHandler[] = []
