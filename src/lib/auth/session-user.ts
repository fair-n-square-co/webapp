import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { getSession } from './session.server'

/**
 * The signed-in user's display identity, or `null` when nobody is signed in.
 * Derived from the WorkOS session — no call to the Go services — so it is cheap
 * enough for a public page to read on every render.
 */
export type SessionUser = Readonly<{
  name: string
  email: string
}>

/**
 * Unlike `fetchProfile`, this does not gate: it returns `null` for an anonymous
 * caller instead of redirecting, so the public home page can branch on it (show the
 * signed-in identity, or a "Log in" call to action). The WorkOS session, token, and
 * SDK stay on the server — only the derived name and email cross to the client.
 */
export const fetchSessionUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    const session = await getSession()
    if (!session) {
      return null
    }

    const { user } = session
    // firstName/lastName are null for passkey/email sign-ups; fall back to the email
    // at the call site rather than inventing a placeholder name here.
    const name = [user.firstName, user.lastName].filter((part): part is string => !!part).join(' ')
    return { name, email: user.email }
  },
)

/**
 * Query options for the current session user. Shared by the route loader (prefetch →
 * dehydrated into the SSR markup) and the screen (reads it back, no refetch).
 */
export function sessionUserQueryOptions() {
  return queryOptions({
    queryKey: ['session-user'],
    queryFn: () => fetchSessionUser(),
  })
}
