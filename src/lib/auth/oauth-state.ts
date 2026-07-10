import { randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * The OAuth `state` parameter, which ties a callback back to the login request
 * that started it. Without it, an attacker can hand a victim's browser a callback
 * URL bearing their own `code` and log the victim into the attacker's account.
 */

const STATE_BYTES = 32

export function createOAuthState(): string {
  return randomBytes(STATE_BYTES).toString('base64url')
}

/** Compare in constant time so the check can't be turned into a byte-at-a-time oracle. */
export function isSameOAuthState(received: string, expected: string): boolean {
  const receivedBytes = Buffer.from(received, 'utf8')
  const expectedBytes = Buffer.from(expected, 'utf8')

  // timingSafeEqual throws on a length mismatch, which would itself leak length.
  if (receivedBytes.length !== expectedBytes.length) {
    return false
  }
  return timingSafeEqual(receivedBytes, expectedBytes)
}
