import { useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { IdentityCard } from './IdentityCard'
import { EditProfile } from './EditProfile'
import { AppearanceControl } from './AppearanceControl'
import { profileQueryOptions } from '../lib/profile/profile-query'

/**
 * The profile screen — read-only by default, with an edit mode for the mutable
 * attributes and preferences.
 *
 * It reads the profile with `useSuspenseQuery`, so the data the route loader
 * prefetched (and SSR dehydrated) is already in the cache on first render: no loading
 * state, no refetch flash. `isEditing` is local view state — which chrome to show —
 * not server state, so a plain `useState` owns it. A successful save writes the
 * refreshed profile back into the `['profile']` cache (see `EditProfile`), so leaving
 * edit mode lands on the updated read-only view with no refetch.
 */
export function ProfileScreen() {
  const { data: profile } = useSuspenseQuery(profileQueryOptions())
  const [isEditing, setIsEditing] = useState(false)

  const displayName = profile.displayName.trim()
  const hasUsername = profile.username.trim() !== ''
  const hasCurrency = profile.preferredCurrency.trim() !== ''

  return (
    <section>
      <div className="page-head">
        <div>
          <h1 className="page-title">Profile</h1>
          <p className="page-sub">Your account.</p>
        </div>
        {!isEditing && (
          <button type="button" className="btn-ghost" onClick={() => setIsEditing(true)}>
            Edit profile
          </button>
        )}
      </div>

      <IdentityCard
        name={displayName}
        placeholder="Unnamed"
        email={profile.email}
        colorSeed={profile.userId}
      />

      {isEditing ? (
        <EditProfile
          profile={profile}
          onCancel={() => setIsEditing(false)}
          onSaved={() => setIsEditing(false)}
        />
      ) : (
        <>
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
                <span className="title">Default currency</span>
                <span className="meta">Amounts show in this currency by default.</span>
              </span>
              {hasCurrency ? (
                <span className="value mono">{profile.preferredCurrency}</span>
              ) : (
                <span className="value unset">No default</span>
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
        </>
      )}

      <p className="eyebrow">Preferences</p>
      <div className="card rows">
        <div className="row">
          <span className="grow">
            <span className="title">Appearance</span>
            <span className="meta">How Fair n Square looks on this device.</span>
          </span>
          {/* Appearance is stored per device (a cookie), not on the profile, so it lives
              outside the save flow and applies the moment it is picked. */}
          <AppearanceControl />
        </div>
      </div>

      <p className="eyebrow">About</p>
      <div className="card about">
        Fair n Square is free, open source, and keeps no score beyond the one you ask it to.
      </div>
    </section>
  )
}
