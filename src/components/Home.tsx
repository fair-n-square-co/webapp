import { useSuspenseQuery } from '@tanstack/react-query'
import { IdentityCard } from './IdentityCard'
import { sessionUserQueryOptions } from '../lib/auth/session-user'

export function Home() {
  // Prefetched by the route loader and dehydrated into the SSR markup, so this reads
  // straight from the cache — no loading flash. `null` means nobody is signed in.
  const { data: sessionUser } = useSuspenseQuery(sessionUserQueryOptions())

  // The app shell (pathless `_app` layout) provides the surrounding <main>, so this
  // renders only the page's own content.
  return (
    <section>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            fair <em>n</em> square
          </h1>
          <p className="page-sub">webapp walking skeleton — React + TanStack Start (BFF).</p>
        </div>
      </div>

      {sessionUser ? (
        <IdentityCard
          name={sessionUser.name}
          placeholder="Signed in"
          email={sessionUser.email}
          colorSeed={sessionUser.email}
        >
          {/* Logout is a POST route (a GET would be CSRF-able), so it must be a form
              submit, not a link. The full-page POST hits the server handler, which
              clears the session and redirects. */}
          <form method="post" action="/auth/logout">
            <button type="submit" className="btn-ghost">
              Log out
            </button>
          </form>
        </IdentityCard>
      ) : (
        // A plain anchor, not a <Link>: `/auth/login` is a server-only route (a GET
        // handler that 302s to WorkOS, no client component). It needs a full-page
        // navigation to reach that handler — a client-side <Link> would resolve to a
        // route with nothing to render and fall through to NotFound.
        <a className="btn-primary" href="/auth/login">
          Log in
        </a>
      )}
    </section>
  )
}
