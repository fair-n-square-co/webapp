/**
 * Shared plumbing for mocking the Go auth service at the wire. Every service the
 * auth process exposes (`IdentityService`, `ProfileService`) lives behind the same
 * base URL, so their handlers share it — and the URL scheme — here.
 */

/** Matches `AUTH_SERVICE_BASE_URL` in the tests that install these handlers. */
export const TEST_AUTH_SERVICE_BASE_URL = 'http://auth.test'

/** Connect addresses a unary method as POST `<baseUrl>/<package>.<Service>/<Method>`. */
export function authServiceMethodUrl(service: string, method: string): string {
  return `${TEST_AUTH_SERVICE_BASE_URL}/fairnsquare.service.authx.v1alpha1.${service}/${method}`
}
