/**
 * Shown when the OAuth callback verified the visitor but could not provision their
 * canonical user (see `auth.callback.ts`). It lives under the `_app` layout, so it
 * already has the shell and nav around it — the visitor can head home or retry rather
 * than landing on a bare error page. "Try signing in again" is a plain anchor because
 * `/auth/login` is a server-only route reached by a full-page navigation.
 */
export function SignInFailed() {
  return (
    <section>
      <div className="page-head">
        <div>
          <h1 className="page-title">We couldn’t finish signing you in</h1>
          <p className="page-sub">
            You were verified, but we couldn’t finish setting up your account.
          </p>
        </div>
      </div>
      <a className="btn-primary" href="/auth/login">
        Try signing in again
      </a>
    </section>
  )
}
