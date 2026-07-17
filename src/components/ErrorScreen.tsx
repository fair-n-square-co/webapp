import { Link } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

/**
 * The router's `defaultErrorComponent`, shown when a route render or loader throws.
 *
 * Unlike {@link NotFound} — which fires at the root boundary, above `_app`, and so
 * wraps itself in the shell — an error boundary renders at the route that threw,
 * *inside* its parent layouts. For every screen under `_app` that means the shell is
 * already around it, so this renders bare content; wrapping it again would nest one
 * shell inside another. (An error above `_app`, e.g. in the root loader, renders
 * without chrome — a plain page is acceptable for that rare case.)
 *
 * `reset` retries the failed render; the error text is shown only in development so
 * we never leak internals to users in production.
 */
export function ErrorScreen({ error, reset }: ErrorComponentProps) {
  return (
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
  )
}
