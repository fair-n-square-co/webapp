import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { AppShell } from './AppShell'
import { ErrorScreen } from './ErrorScreen'

// Regression: ErrorScreen used to wrap itself in AppShell, but an error boundary
// renders at the route that threw, *inside* its parent layouts — so any screen under
// the `_app` layout that failed got the shell twice, one nested inside the other.
// This harness mirrors the app's real composition (router.tsx + _app.tsx): a root
// route, a pathless layout providing the shell, and a child whose loader throws.
function renderFailingRouteInsideShell() {
  const rootRoute = createRootRoute({ component: Outlet })
  const layoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: 'app',
    component: () => (
      <AppShell>
        <Outlet />
      </AppShell>
    ),
  })
  const failingRoute = createRoute({
    getParentRoute: () => layoutRoute,
    path: '/',
    loader: () => {
      throw new Error('the loader failed')
    },
    component: () => null,
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([layoutRoute.addChildren([failingRoute])]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    defaultErrorComponent: ErrorScreen,
  })

  return render(<RouterProvider router={router} />)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ErrorScreen', () => {
  it('shows the failure inside a single app shell when a route errors', async () => {
    // The router logs the loader error; that noise is expected here.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderFailingRouteInsideShell()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Something went wrong' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()

    // One AppShell renders exactly two "Main" navs (sidebar + bottom bar). Four
    // would mean the shell nested itself again — the bug this test pins down.
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(2)
  })
})
