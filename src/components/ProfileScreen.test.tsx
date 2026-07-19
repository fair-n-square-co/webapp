import { Suspense } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProfileScreen } from './ProfileScreen'
import { profileQueryOptions } from '../lib/profile/profile-query'
import type { ProfileDraft, SaveProfileResult, UserProfile } from '../lib/profile/types'

// A TanStack Start server function cannot run under jsdom — it needs the server
// runtime's Start context — so `saveProfile` is the one seam we replace. It is the
// client→BFF network boundary; the component test drives it with canned outcomes and
// asserts what the user sees, while the real wire contract (token forwarding + the
// full preferences block) is covered at the Connect boundary in
// `profile-rpc.server.test.ts`.
const { saveProfileMock } = vi.hoisted(() => ({
  saveProfileMock: vi.fn<(args: { data: ProfileDraft }) => Promise<SaveProfileResult>>(),
}))

vi.mock('../lib/profile/profile-query', () => ({
  saveProfile: saveProfileMock,
  profileQueryOptions: () => ({
    queryKey: ['profile'] as const,
    // Seeded directly in every test, so this must never actually run.
    queryFn: (): never => {
      throw new Error('profileQueryOptions.queryFn should not be called in these tests')
    },
  }),
}))

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
  preferredCurrency: 'AUD',
  locale: 'en-AU',
  timezone: 'Australia/Sydney',
}

beforeEach(() => {
  saveProfileMock.mockReset()
})

describe('ProfileScreen (read-only view)', () => {
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

  it('offers a log-out control in the account section', () => {
    // The only log-out reachable on mobile, where the sidebar's account area
    // does not exist. It must POST (a GET would be CSRF-able).
    renderProfile(BASE_PROFILE)

    const logout = screen.getByRole('button', { name: 'Log out' })
    expect(logout.closest('form')).toHaveAttribute('action', '/auth/logout')
    expect(logout.closest('form')).toHaveAttribute('method', 'post')
  })

  it('falls back to a placeholder name when the display name is empty', () => {
    renderProfile({ ...BASE_PROFILE, displayName: '' })

    expect(screen.getByRole('heading', { level: 2, name: 'Unnamed' })).toBeInTheDocument()
    // The email is still the real one — only the name is missing.
    expect(screen.getByText('ada@example.com')).toBeInTheDocument()
  })
})

async function openEditor(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Edit profile' }))
  return user
}

describe('ProfileScreen (edit mode)', () => {
  it('saves an edited display name and reflects it in the refreshed view', async () => {
    renderProfile(BASE_PROFILE)
    const user = await openEditor()

    const nameInput = screen.getByLabelText('Display name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Ada Byron')

    saveProfileMock.mockResolvedValueOnce({
      status: 'ok',
      profile: { ...BASE_PROFILE, displayName: 'Ada Byron' },
    } satisfies SaveProfileResult)

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    // The refreshed cache drives the view: back to read-only with the new name.
    expect(await screen.findByRole('heading', { level: 2, name: 'Ada Byron' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument()
    const draft = saveProfileMock.mock.calls[0]?.[0].data
    expect(draft?.displayName).toBe('Ada Byron')
    expect(draft?.email).toBe('ada@example.com')
  })

  it('saves with an empty username and does not block the other edits', async () => {
    // The optional-when-empty payoff: clearing the username is a valid save, and the
    // full-replace payload still carries the untouched locale/timezone.
    renderProfile(BASE_PROFILE)
    const user = await openEditor()

    await user.clear(screen.getByLabelText('Username'))

    saveProfileMock.mockResolvedValueOnce({
      status: 'ok',
      profile: { ...BASE_PROFILE, username: '' },
    } satisfies SaveProfileResult)

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Not set yet')).toBeInTheDocument()
    // The full-replace payload carries the empty username AND the untouched
    // locale/timezone, so the save neither is blocked nor clobbers preferences.
    const draft = saveProfileMock.mock.calls[0]?.[0].data
    expect(draft?.username).toBe('')
    expect(draft?.locale).toBe('en-AU')
    expect(draft?.timezone).toBe('Australia/Sydney')
    // The display name and email were not lost by clearing the username.
    expect(screen.getByRole('heading', { level: 2, name: 'Ada Lovelace' })).toBeInTheDocument()
  })

  it('surfaces a taken username inline and stays in edit mode', async () => {
    renderProfile(BASE_PROFILE)
    const user = await openEditor()

    saveProfileMock.mockResolvedValueOnce({
      status: 'alreadyExists',
      field: 'username',
    } satisfies SaveProfileResult)

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('That username is already taken.')).toBeInTheDocument()
    // Still editing so the user can pick a different handle.
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })

  it('surfaces a retryable error and stays in edit mode when the save faults', async () => {
    // `saveProfile` throws for every fault path (Unavailable, NotFound, a hollow
    // reply). Without an onError handler the user would see 'Saving…' flip back to
    // 'Save changes' with no message — a silent dead-end. Assert the generic error
    // shows and the form stays editable so the user can retry.
    renderProfile(BASE_PROFILE)
    const user = await openEditor()

    saveProfileMock.mockRejectedValueOnce(new Error('profile service is down'))

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(
      await screen.findByText('Something went wrong saving your changes. Please try again.'),
    ).toBeInTheDocument()
    // Still in edit mode so the user can try again, not bounced back to read-only.
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument()
  })

  it('surfaces a form-level conflict when the taken field is unknown', async () => {
    // The service reports AlreadyExists without naming a field, so the BFF returns
    // `unknown`; the editor must not mislabel an input and shows a form-level message.
    renderProfile(BASE_PROFILE)
    const user = await openEditor()

    saveProfileMock.mockResolvedValueOnce({
      status: 'alreadyExists',
      field: 'unknown',
    } satisfies SaveProfileResult)

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('That username or email is already in use.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })

  it('shows a persisted currency that is outside the offered list rather than a blank select', async () => {
    // A currency set by another client may not be one of the offered codes. It must
    // still appear as the selected value, not leave the control blank (which reads as
    // "no default" when a default is in fact set).
    renderProfile({ ...BASE_PROFILE, preferredCurrency: 'CHF' })
    await openEditor()

    const currency = screen.getByLabelText<HTMLSelectElement>('Default currency')
    expect(currency.value).toBe('CHF')
    expect(screen.getByRole('option', { name: 'CHF' })).toBeInTheDocument()
  })

  it('shows a validation error for an invalid email and fires no request', async () => {
    renderProfile(BASE_PROFILE)
    const user = await openEditor()

    const emailInput = screen.getByLabelText('Email')
    await user.clear(emailInput)
    await user.type(emailInput, 'not-an-email')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(saveProfileMock).not.toHaveBeenCalled()
  })

  it('disables the submit control and shows a saving state while the mutation is in flight', async () => {
    renderProfile(BASE_PROFILE)
    const user = await openEditor()

    let releaseSave: (result: SaveProfileResult) => void = () => {}
    saveProfileMock.mockReturnValueOnce(
      new Promise<SaveProfileResult>((resolve) => {
        releaseSave = resolve
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    const saving = await screen.findByRole('button', { name: 'Saving…' })
    expect(saving).toBeDisabled()

    // Let it settle so the test leaves no pending state behind.
    releaseSave({ status: 'ok', profile: BASE_PROFILE })
    expect(await screen.findByRole('button', { name: 'Edit profile' })).toBeInTheDocument()
  })

  it('locks the fields while saving so in-flight edits cannot be silently dropped', async () => {
    // The draft is captured at submit. If the fields stayed editable, anything typed
    // during the round-trip would never reach the service, and success closes the
    // editor — discarding those edits with no sign to the user that it happened.
    renderProfile(BASE_PROFILE)
    const user = await openEditor()

    let releaseSave: (result: SaveProfileResult) => void = () => {}
    saveProfileMock.mockReturnValueOnce(
      new Promise<SaveProfileResult>((resolve) => {
        releaseSave = resolve
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByRole('button', { name: 'Saving…' })

    expect(screen.getByLabelText('Display name')).toBeDisabled()
    expect(screen.getByLabelText('Username')).toBeDisabled()
    expect(screen.getByLabelText('Email')).toBeDisabled()
    expect(screen.getByLabelText('Default currency')).toBeDisabled()

    releaseSave({ status: 'ok', profile: BASE_PROFILE })
    expect(await screen.findByRole('button', { name: 'Edit profile' })).toBeInTheDocument()
  })
})
