import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Icon } from '../lib/ui/icons'
import type { IconName } from '../lib/ui/icons'

/**
 * The application chrome: a sticky sidebar on desktop and a bottom tab bar with a
 * central action button under 900px (ADR-5 shell, ported from fns-ui-poc). It owns
 * only navigation and layout — screens render into `children` (the router `Outlet`).
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

export function AppShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <Brand />
        {NAV_DESTINATIONS.map((item) => (
          <NavLink key={item.to} {...item} />
        ))}
        <AddAction variant="cta" />
        <span className="spacer" />
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
