/**
 * The profile as the rest of the app cares about it — the trusted shape that has
 * already crossed the BFF boundary (see `getProfile`). Kept free of any server-only
 * import so the client bundle and its components can share it.
 */
export type UserProfile = Readonly<{
  /** Stable internal id (UUID) of the canonical user. Never empty. */
  userId: string
  /**
   * Discovery handle. May be empty: JIT-provisioned users have not chosen one yet
   * (the contract is optional-when-empty), so an empty string is a normal state the
   * UI renders as "not set", not an error.
   */
  username: string
  /** Human-facing display name. May be empty until the user sets it. */
  displayName: string
  /** Canonical email. Never empty — it is set at provisioning from the login. */
  email: string
  /**
   * ISO-4217 currency the user reads amounts in by default (e.g. "AUD"). May be empty
   * (no default chosen). This is the one preference the edit screen owns.
   */
  preferredCurrency: string
  /**
   * BCP-47 locale tag (e.g. "en-AU"). NOT edited by this UI, but carried so a
   * full-replace save can round-trip it back unchanged instead of clobbering it.
   */
  locale: string
  /**
   * IANA timezone (e.g. "Australia/Sydney"). NOT edited by this UI, but carried so a
   * full-replace save can round-trip it back unchanged instead of clobbering it.
   */
  timezone: string
}>

/**
 * The complete desired state of a profile the user submits from the edit screen.
 * `UpdateProfile` is full-replace (PUT): every mutable attribute is sent, so `locale`
 * and `timezone` ride along untouched even though nothing edits them here.
 */
export type ProfileDraft = Readonly<{
  username: string
  displayName: string
  email: string
  preferredCurrency: string
  locale: string
  timezone: string
}>

/** Which field a server-side uniqueness conflict was about, when the message reveals it. */
export type ConflictField = 'username' | 'email' | 'unknown'

/**
 * The outcome of a save the UI can act on. `ok` refreshes the cache; the two failure
 * variants are surfaced inline. Anything unexpected (Unavailable, NotFound, a hollow
 * reply) is thrown by `updateProfile` rather than modelled here — it is a fault, not a
 * result the user can correct by editing the form.
 */
export type SaveProfileResult =
  | Readonly<{ status: 'ok'; profile: UserProfile }>
  | Readonly<{ status: 'alreadyExists'; field: ConflictField }>
  | Readonly<{ status: 'invalidArgument'; message: string }>
