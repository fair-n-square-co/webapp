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

/** Where the BFF reaches the Go auth service over connectRPC. */
export type AuthServiceConfig = Readonly<{
  baseUrl: string
}>

export function getAuthServiceConfig(): AuthServiceConfig {
  const baseUrl = requireEnv('AUTH_SERVICE_BASE_URL')

  // connectRPC appends `/<package>.<Service>/<Method>` to this, so a typo'd base
  // would otherwise surface as a confusing 404 from whatever host it resolved to.
  try {
    new URL(baseUrl)
  } catch {
    throw new Error(`AUTH_SERVICE_BASE_URL must be an absolute URL, got: ${baseUrl}`)
  }

  return { baseUrl }
}
