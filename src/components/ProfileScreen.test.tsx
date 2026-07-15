import { Suspense } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProfileScreen } from './ProfileScreen'
import { profileQueryOptions } from '../lib/profile/profile-query'
import type { UserProfile } from '../lib/profile/types'

// The screen reads the profile with `useSuspenseQuery`, exactly as it does in the
// app after the loader has warmed the cache. Here we seed the same cache directly so
// the render is what we assert on — the BFF/network boundary is covered at the wire
// in `profile.server.test.ts`. `staleTime: Infinity` keeps the seeded data from being
// treated as stale and refetched, mirroring the hydrated-and-fresh production path.
function renderProfile(profile: UserProfile) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  })
  queryClient.setQueryData(profileQueryOptions().queryKey, profile)

  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <ProfileScreen />
      </Suspense>
    </QueryClientProvider>,
  )
}

const BASE_PROFILE: UserProfile = {
  userId: 'user_01HZY',
  username: 'ada',
  displayName: 'Ada Lovelace',
  email: 'ada@example.com',
}

describe('ProfileScreen', () => {
  it('shows the display name, username handle and email', () => {
    renderProfile(BASE_PROFILE)

    expect(screen.getByRole('heading', { level: 2, name: 'Ada Lovelace' })).toBeInTheDocument()
    expect(screen.getByText('@ada')).toBeInTheDocument()
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
  })

  it('shows a neutral placeholder when the username has not been set', () => {
    // JIT-provisioned users have no username yet; that is a normal state, not an error.
    renderProfile({ ...BASE_PROFILE, username: '' })

    expect(screen.getByText('Not set yet')).toBeInTheDocument()
    expect(screen.queryByText('@')).not.toBeInTheDocument()
  })

  it('falls back to a placeholder name when the display name is empty', () => {
    renderProfile({ ...BASE_PROFILE, displayName: '' })

    expect(screen.getByRole('heading', { level: 2, name: 'Unnamed' })).toBeInTheDocument()
    // The email is still the real one — only the name is missing.
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
  })
})
