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
}>
