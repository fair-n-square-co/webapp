import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Icon } from '../lib/ui/icons'
import type { IconName } from '../lib/ui/icons'
import { Avatar } from '../lib/ui/Avatar'
import type { SessionUser } from '../lib/auth/session-user'

/**
 * The application chrome: a sticky sidebar on desktop and a bottom tab bar with a
 * central action button under 900px (ADR-5 shell, ported from fns-ui-poc). It owns
 * navigation and layout — screens render into `children` (the router `Outlet`) —
 * plus the sidebar's log in/out affordance. Who is signed in arrives as a prop (the
 * `_app` layout reads the primed query and passes it), so the shell itself stays
 * free of data coupling and callers without session state (`NotFound` at the root
 * boundary) simply omit it.
 */

type NavDestination = {
  to: '/' | '/profile'
  label: string
  icon: IconName
}

// Only destinations that have a route today. More tabs join as their screens land;
// the typed `to` means a link to a route that does not exist won't compile.
const HOME: NavDestination = { to: '/', label: 'Home', icon: 'home' }
const PROFILE: NavDestination = { to: '/profile', label: 'Profile', icon: 'profile' }
const NAV_DESTINATIONS: readonly NavDestination[] = [HOME, PROFILE]

function Brand() {
  return (
    <span className="brand">
      <span className="brandmark" aria-hidden />
      <span className="brandname">
        fair <em>n</em> square
      </span>
    </span>
  )
}

function NavLink({ to, label, icon }: NavDestination) {
  return (
    <Link
      to={to}
      className="navitem"
      activeProps={{ className: 'navitem active' }}
      // Home would otherwise stay "active" on every route, since every path starts with "/".
      activeOptions={{ exact: to === '/' }}
    >
      <Icon name={icon} />
      {label}
    </Link>
  )
}

// The add-expense flow arrives with the expense feature; the shell reserves its
// signature affordance now so the layout is settled. Inert until then.
function AddAction({ variant }: { variant: 'fab' | 'cta' }) {
  if (variant === 'fab') {
    return (
      <button
        type="button"
        className="fab"
        aria-label="Add expense (coming soon)"
        title="Add expense — coming soon"
        disabled
      >
        <Icon name="plus" />
      </button>
    )
  }
  return (
    <button type="button" className="add-cta" title="Add expense — coming soon" disabled>
      <Icon name="plus" />
      Add expense
    </button>
  )
}

/**
 * The sidebar's log in/out corner. Signed in: a compact identity chip and a log-out
 * button; anonymous: a log-in button. The sidebar only exists on desktop — on mobile
 * the login path is the Home CTA (or the gated Profile tab redirecting to login), and
 * logout lives in the profile screen's account row.
 */
function AccountArea({ sessionUser }: Readonly<{ sessionUser: SessionUser | null }>) {
  if (!sessionUser) {
    return (
      <div className="account">
        {/* A plain anchor, not a <Link>: `/auth/login` is a server-only route (a GET
            handler that 302s to WorkOS) and needs a full-page navigation to reach it. */}
        <a className="btn-primary" href="/auth/login">
          Log in
        </a>
      </div>
    )
  }

  return (
    <div className="account">
      <div className="account-id">
        <Avatar
          name={sessionUser.name || sessionUser.email}
          colorSeed={sessionUser.email}
          size="sm"
        />
        <span className="who">
          <span className="name">{sessionUser.name || 'Signed in'}</span>
          <span className="email">{sessionUser.email}</span>
        </span>
      </div>
      {/* Logout is a POST route (a GET would be CSRF-able), so it must be a form
          submit, not a link. The full-page POST hits the server handler, which
          clears the session and redirects. */}
      <form method="post" action="/auth/logout">
        <button type="submit" className="btn-ghost">
          Log out
        </button>
      </form>
    </div>
  )
}

type AppShellProps = Readonly<{
  children: ReactNode
  /**
   * The signed-in user (`null` when nobody is), shown in the sidebar's account area.
   * Omit it — e.g. from the root-level `NotFound`, where no loader primed the session
   * — and the shell renders without the account area rather than fetching anything.
   */
  sessionUser?: SessionUser | null | undefined
}>

export function AppShell({ children, sessionUser }: AppShellProps) {
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <Brand />
        {NAV_DESTINATIONS.map((item) => (
          <NavLink key={item.to} {...item} />
        ))}
        <AddAction variant="cta" />
        <span className="spacer" />
        {sessionUser !== undefined ? <AccountArea sessionUser={sessionUser} /> : null}
        <span style={{ fontSize: 11.5, color: 'var(--ink-faint)', padding: '0 12px' }}>
          free &amp; open source · no paywall on fairness
        </span>
      </nav>

      <main className="main">{children}</main>

      <nav className="bottomnav" aria-label="Main">
        <NavLink {...HOME} />
        <AddAction variant="fab" />
        <NavLink {...PROFILE} />
      </nav>
    </div>
  )
}
