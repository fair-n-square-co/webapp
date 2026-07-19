import { expect, test } from '@playwright/test'

// Liveness probe the ALB target group relies on.
test('GET /healthz returns 200 ok', async ({ request }) => {
  const res = await request.get('/healthz')
  expect(res.ok()).toBe(true)
  expect(await res.text()).toContain('ok')
})
