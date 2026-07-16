import { describe, expect, it } from 'vitest'
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
import type { SessionUser } from '../lib/auth/session-user'

// AppShell renders router <Link>s, so it mounts inside a minimal real router — the
// same harness ErrorScreen.test.tsx uses. The session user arrives as a prop, exactly
// as the `_app` layout passes it; `undefined` is the NotFound-at-root case where no
// loader primed the session.
function renderShell({ sessionUser }: { sessionUser?: SessionUser | null }) {
  const rootRoute = createRootRoute({
    component: () => (
      <AppShell sessionUser={sessionUser}>
        <Outlet />
      </AppShell>
    ),
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <div>page content</div>,
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  return render(<RouterProvider router={router} />)
}

describe('AppShell', () => {
  it('shows the signed-in identity and a log-out control in the sidebar', async () => {
    renderShell({ sessionUser: { name: 'Ada Lovelace', email: 'ada@example.com' } })

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()

    // Logout must POST (a GET would be CSRF-able), so it is a form submit.
    const logout = screen.getByRole('button', { name: 'Log out' })
    expect(logout.closest('form')).toHaveAttribute('action', '/auth/logout')
    expect(logout.closest('form')).toHaveAttribute('method', 'post')
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument()
  })

  it('falls back to a neutral label when the signed-in user has no name', async () => {
    renderShell({ sessionUser: { name: '', email: 'grace@example.com' } })

    expect(await screen.findByText('Signed in')).toBeInTheDocument()
    expect(screen.getByText('grace@example.com')).toBeInTheDocument()
  })

  it('shows a log-in call to action when nobody is signed in', async () => {
    renderShell({ sessionUser: null })

    // A full-page navigation to the server-only login route, not a client <Link>.
    const login = await screen.findByRole('link', { name: 'Log in' })
    expect(login).toHaveAttribute('href', '/auth/login')
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
  })

  it('renders no account area when the session is unknown', async () => {
    // NotFound renders the shell at the root boundary, where no loader primed the
    // session — the shell must not guess or fetch, just leave the corner out.
    renderShell({})

    expect(await screen.findByText('page content')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Log out' })).not.toBeInTheDocument()
    // The navigation itself is always there.
    expect(screen.getAllByRole('navigation', { name: 'Main' })).toHaveLength(2)
  })
})
