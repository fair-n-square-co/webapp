/**
 * Auth configuration, read from the environment.
 *
 * Read lazily rather than at module scope: a missing variable should fail the
 * request that needs it, not the build or a `vite dev` boot that never touches auth.
 */

/** Iron derives the seal key from this password and rejects anything shorter. */
const MIN_COOKIE_PASSWORD_LENGTH = 32

export type WorkOSConfig = Readonly<{
  apiKey: string
  clientId: string
  cookiePassword: string
  redirectUri: string
}>

function requireEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getWorkOSConfig(): WorkOSConfig {
  const cookiePassword = requireEnv('WORKOS_COOKIE_PASSWORD')
  // Checked here so a too-short password surfaces as a clear error rather than
  // as an opaque failure deep inside the seal step on the OAuth callback.
  if (cookiePassword.length < MIN_COOKIE_PASSWORD_LENGTH) {
    throw new Error(
      `WORKOS_COOKIE_PASSWORD must be at least ${MIN_COOKIE_PASSWORD_LENGTH} characters, got ${cookiePassword.length}`,
    )
  }

  return {
    apiKey: requireEnv('WORKOS_API_KEY'),
    clientId: requireEnv('WORKOS_CLIENT_ID'),
    cookiePassword,
    redirectUri: requireEnv('WORKOS_REDIRECT_URI'),
  }
}

/**
 * A call to the auth service holds the login open, so it gets a deadline rather than
 * the transport's default of none. Without one, an auth service that accepts the
 * connection and then stalls would hang the OAuth callback — and the request's server
 * resources — for as long as it felt like.
 */
const DEFAULT_AUTH_SERVICE_TIMEOUT_MS = 5_000

/** Where the BFF reaches the Go auth service over connectRPC, and how long it will wait. */
export type AuthServiceConfig = Readonly<{
  baseUrl: string
  timeoutMs: number
}>

export function getAuthServiceConfig(): AuthServiceConfig {
  return {
    baseUrl: requireAuthServiceBaseUrl(),
    timeoutMs: readAuthServiceTimeoutMs(),
  }
}

function requireAuthServiceBaseUrl(): string {
  const baseUrl = requireEnv('AUTH_SERVICE_BASE_URL')

  // connectRPC appends `/<package>.<Service>/<Method>` to this, so a typo'd base would
  // otherwise surface as a confusing 404 from whatever host it resolved to. The scheme is
  // checked too: `new URL` happily accepts `file:` or `mailto:`, which would pass this
  // check and then fail every single call at runtime instead.
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new Error(`AUTH_SERVICE_BASE_URL must be an absolute URL, got: ${baseUrl}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`AUTH_SERVICE_BASE_URL must be http or https, got: ${url.protocol}`)
  }

  return baseUrl
}

/** Optional: an ops knob for a slow environment, not something a deploy has to set. */
function readAuthServiceTimeoutMs(): number {
  const configured = process.env['AUTH_SERVICE_TIMEOUT_MS']
  if (configured === undefined || configured === '') {
    return DEFAULT_AUTH_SERVICE_TIMEOUT_MS
  }

  const timeoutMs = Number(configured)
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`AUTH_SERVICE_TIMEOUT_MS must be a positive integer, got: ${configured}`)
  }
  return timeoutMs
}
