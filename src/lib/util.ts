/** Small, typed display helpers ported from the POC as the profile screen needs them. */

/**
 * Up to two uppercase initials for an avatar. Falls back to `?` for an empty or
 * whitespace-only name, so a user who has not set a display name still gets a stable
 * glyph rather than an empty circle.
 */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()
}

/**
 * A stable hue (0–359) derived from a string, so a given user always gets the same
 * avatar colour. The POC carried an explicit `hue` per mock user; real users have
 * none, so we hash a stable key (their id) into one. Any small string hash does —
 * this only needs determinism and a reasonable spread, not cryptographic strength.
 */
export function hueFromString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash) % 360
}
