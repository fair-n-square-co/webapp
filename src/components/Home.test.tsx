import { Suspense } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Home } from './Home'
import { sessionUserQueryOptions } from '../lib/auth/session-user'
import type { SessionUser } from '../lib/auth/session-user'

// Home reads the session user with `useSuspenseQuery`, exactly as it does in the app
// after the loader warms the cache. We seed the same cache directly so the render is
// what we assert on — the session/BFF boundary is covered separately. `null` is the
// anonymous case the loader returns for a signed-out visitor.
function renderHome(sessionUser: SessionUser | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
  queryClient.setQueryData(sessionUserQueryOptions().queryKey, sessionUser)

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <Home />
      </Suspense>
    </QueryClientProvider>,
  )
}

describe('Home', () => {
  it('renders the app name as the page heading', () => {
    renderHome(null)

    expect(screen.getByRole('heading', { level: 1, name: /fair.*square/i })).toBeInTheDocument()
  })

  it('shows the signed-in name and email', () => {
    // Log out lives in the shell's account area (see AppShell.test.tsx), not here.
    renderHome({ name: 'Ada Lovelace', email: 'ada@example.com' })

    expect(screen.getByRole('heading', { level: 2, name: 'Ada Lovelace' })).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
    // The login call-to-action is not shown while signed in.
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument()
  })

  it('falls back to a neutral name when the WorkOS profile has none', () => {
    // Passkey/email sign-ups have no first or last name; the email still stands in.
    renderHome({ name: '', email: 'grace@example.com' })

    expect(screen.getByRole('heading', { level: 2, name: 'Signed in' })).toBeInTheDocument()
    expect(screen.getByText('grace@example.com')).toBeInTheDocument()
  })

  it('shows a log-in call to action when nobody is signed in', () => {
    renderHome(null)

    const login = screen.getByRole('link', { name: 'Log in' })
    expect(login).toBeInTheDocument()
    // A full-page navigation to the server-only login route, not a client <Link>.
    expect(login).toHaveAttribute('href', '/auth/login')
  })
})
