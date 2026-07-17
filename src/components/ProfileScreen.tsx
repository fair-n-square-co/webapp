import { useSuspenseQuery } from '@tanstack/react-query'
import { IdentityCard } from './IdentityCard'
import { profileQueryOptions } from '../lib/profile/profile-query'

/**
 * The read-only profile screen — the design system's first real consumer.
 *
 * It reads the profile with `useSuspenseQuery`, so the data the route loader
 * prefetched (and SSR dehydrated) is already in the cache on first render: no
 * loading state, no refetch flash. Editing and preferences are a later change; this
 * screen only shows what is there.
 */
export function ProfileScreen() {
  const { data: profile } = useSuspenseQuery(profileQueryOptions())

  const displayName = profile.displayName.trim()
  const hasUsername = profile.username.trim() !== ''

  return (
    <section>
      <div className="page-head">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-sub">Your account.</p>
        </div>
      </div>

      <IdentityCard
        name={displayName}
        placeholder="Unnamed"
        email={profile.email}
        colorSeed={profile.userId}
      />

      <p className="eyebrow">Account</p>
      <div className="card rows">
        <div className="row">
          <span className="grow">
            <span className="title">Username</span>
            <span className="meta">Others find you by this handle.</span>
          </span>
          {hasUsername ? (
            <span className="value mono">@{profile.username}</span>
          ) : (
            <span className="value unset">Not set yet</span>
          )}
        </div>
        <div className="row">
          <span className="grow">
            <span className="title">Session</span>
            <span className="meta">Sign out of Fair n Square on this device.</span>
          </span>
          {/* Logout is a POST route (a GET would be CSRF-able), so it must be a form
              submit, not a link. Also the only log-out reachable on mobile, where the
              sidebar (and its account area) does not exist. */}
          <form method="post" action="/auth/logout">
            <button type="submit" className="btn-danger-ghost">
              Log out
            </button>
          </form>
        </div>
      </div>

      <p className="eyebrow">About</p>
      <div className="card about">
        Fair n Square is free, open source, and keeps no score beyond the one you ask it to.
      </div>
    </section>
  )
}
