import { Link } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { AppShell } from './AppShell'

/**
 * The router's `defaultErrorComponent`, shown when a route render or loader throws.
 * Like {@link NotFound} it renders above `_app`, so it wraps itself in `AppShell` to
 * keep the nav reachable. `reset` retries the failed render; the error text is shown
 * only in development so we never leak internals to users in production.
 */
export function ErrorScreen({ error, reset }: ErrorComponentProps) {
  return (
    <AppShell>
      <section>
        <div className="page-head">
          <div>
            <h1 className="page-title">Something went wrong</h1>
            <p className="page-sub">An unexpected error stopped this page from loading.</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn-primary" onClick={reset}>
            Try again
          </button>
          <Link className="btn-ghost" to="/">
            Back to home
          </Link>
        </div>
        {import.meta.env.DEV ? (
          <pre className="card about" style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}>
            {error.message}
          </pre>
        ) : null}
      </section>
    </AppShell>
  )
}
