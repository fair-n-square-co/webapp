import { useState } from 'react'
import type { ReactElement } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { profileQueryOptions, saveProfile } from '../lib/profile/profile-query'
import type { ProfileDraft, SaveProfileResult, UserProfile } from '../lib/profile/types'

type EditProfileProps = Readonly<{
  profile: UserProfile
  onCancel: () => void
  onSaved: () => void
}>

/** ISO-4217 codes offered as defaults. Empty is a valid choice — "no default". */
const CURRENCY_OPTIONS = [
  { code: '', label: 'No default' },
  { code: 'AUD', label: 'AUD — Australian dollar' },
  { code: 'USD', label: 'USD — US dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British pound' },
  { code: 'NZD', label: 'NZD — New Zealand dollar' },
  { code: 'CAD', label: 'CAD — Canadian dollar' },
  { code: 'INR', label: 'INR — Indian rupee' },
  { code: 'JPY', label: 'JPY — Japanese yen' },
  { code: 'SGD', label: 'SGD — Singapore dollar' },
] as const

// A pragmatic syntactic check: a local part, an @, and a dotted domain. The service
// is the authority (uniqueness, canonicalisation) — this only stops an obviously
// malformed address from making a pointless round-trip.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function assertNever(value: never): never {
  throw new Error(`unexpected value: ${JSON.stringify(value)}`)
}

export function EditProfile({ profile, onCancel, onSaved }: EditProfileProps): ReactElement {
  const queryClient = useQueryClient()

  const [displayName, setDisplayName] = useState(profile.displayName)
  const [username, setUsername] = useState(profile.username)
  const [email, setEmail] = useState(profile.email)
  const [preferredCurrency, setPreferredCurrency] = useState(profile.preferredCurrency)

  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (draft: ProfileDraft): Promise<SaveProfileResult> => saveProfile({ data: draft }),
    onSuccess: (result) => {
      switch (result.status) {
        case 'ok':
          // Success is reflected by the refreshed cache: write the persisted profile
          // back under the shared key and return to the read-only view.
          queryClient.setQueryData(profileQueryOptions().queryKey, result.profile)
          onSaved()
          return
        case 'alreadyExists':
          if (result.field === 'username') {
            setUsernameError('That username is already taken.')
          } else if (result.field === 'email') {
            setEmailError('That email is already in use.')
          } else {
            setFormError('That username or email is already in use.')
          }
          return
        case 'invalidArgument':
          setFormError(result.message || 'Some of those details were not accepted.')
          return
        default:
          assertNever(result)
      }
    },
    onError: () => {
      // `updateProfile` throws for every fault path — the service being Unavailable,
      // a NotFound, or a hollow/untrusted reply. None of those are correctable by
      // editing a field, so surface one generic, retryable message rather than
      // leaving the form to silently revert. The form stays in edit mode.
      setFormError('Something went wrong saving your changes. Please try again.')
    },
  })

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    setUsernameError(null)
    setEmailError(null)
    setFormError(null)

    const trimmedEmail = email.trim()
    // Client-side validation gates the request: a malformed email fires no RPC at all.
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setEmailError('Enter a valid email address.')
      return
    }

    mutation.mutate({
      username: username.trim(),
      displayName: displayName.trim(),
      email: trimmedEmail,
      preferredCurrency,
      // Full-replace: carry the untouched preferences through so the save does not
      // clobber locale/timezone to empty.
      locale: profile.locale,
      timezone: profile.timezone,
    })
  }

  const isSaving = mutation.isPending
  const usernameIsEmpty = username.trim() === ''

  // A currency persisted by another client can fall outside the offered list. Inject
  // the current value as an extra option so the control shows it, rather than rendering
  // a blank/unselected select that reads as "no default" when a default is in fact set.
  const currencyOptions =
    preferredCurrency && !CURRENCY_OPTIONS.some((option) => option.code === preferredCurrency)
      ? [...CURRENCY_OPTIONS, { code: preferredCurrency, label: preferredCurrency }]
      : CURRENCY_OPTIONS

  return (
    <form className="edit-form" onSubmit={handleSubmit} noValidate>
      <div className="card form-card">
        <div className="field">
          <label htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            value={displayName}
            autoComplete="name"
            disabled={isSaving}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            value={username}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={isSaving}
            aria-invalid={usernameError !== null}
            aria-describedby={usernameError ? 'username-error' : 'username-hint'}
            onChange={(event) => setUsername(event.target.value)}
          />
          {usernameError ? (
            <p id="username-error" className="field-error" role="alert">
              {usernameError}
            </p>
          ) : (
            <p id="username-hint" className="field-hint">
              {usernameIsEmpty
                ? 'Optional — pick a username so friends can find you.'
                : 'Others find you by this handle.'}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            autoComplete="email"
            disabled={isSaving}
            aria-invalid={emailError !== null}
            aria-describedby={emailError ? 'email-error' : undefined}
            onChange={(event) => setEmail(event.target.value)}
          />
          {emailError ? (
            <p id="email-error" className="field-error" role="alert">
              {emailError}
            </p>
          ) : null}
        </div>

        <div className="field">
          <label htmlFor="preferredCurrency">Default currency</label>
          <select
            id="preferredCurrency"
            name="preferredCurrency"
            value={preferredCurrency}
            disabled={isSaving}
            onChange={(event) => setPreferredCurrency(event.target.value)}
          >
            {currencyOptions.map((option) => (
              <option key={option.code || 'none'} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
        <button type="submit" className="btn-primary" disabled={isSaving} aria-busy={isSaving}>
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
