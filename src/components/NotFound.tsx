import { Link } from '@tanstack/react-router'
import { AppShell } from './AppShell'

/**
 * The router's `defaultNotFoundComponent`. It renders at the root, above the `_app`
 * layout, so it wraps itself in `AppShell` to keep the same chrome (nav, log in/out)
 * as every other screen — an unknown URL is still a navigable page, not a dead end.
 */
export function NotFound() {
  return (
    <AppShell>
      <section>
        <div className="page-head">
          <div>
            <h1 className="page-title">Page not found</h1>
            <p className="page-sub">That page doesn’t exist, or it may have moved.</p>
          </div>
        </div>
        <Link className="btn-primary" to="/">
          Back to home
        </Link>
      </section>
    </AppShell>
  )
}
