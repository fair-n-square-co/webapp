import { afterEach, describe, expect, it } from 'vitest'
import { THEME_COOKIE_NAME, ThemePreference, readThemePreference } from './theme'

/**
 * `readThemePreference` runs from a mount effect in `AppearanceControl`, so anything it
 * throws takes the screen down. The cookie it reads is fully browser-controlled — a
 * user, an extension, or a truncated write can leave arbitrary bytes there — which
 * makes "never throw, fall back to system" the contract worth pinning.
 */

function setThemeCookie(value: string): void {
  document.cookie = `${THEME_COOKIE_NAME}=${value}; path=/`
}

afterEach(() => {
  document.cookie = `${THEME_COOKIE_NAME}=; path=/; max-age=0`
})

describe('readThemePreference', () => {
  it('returns the persisted preference', () => {
    setThemeCookie('dark')

    expect(readThemePreference()).toBe(ThemePreference.Dark)
  })

  it('defaults to system when no cookie is set', () => {
    expect(readThemePreference()).toBe(ThemePreference.System)
  })

  it('defaults to system for an unrecognised value', () => {
    setThemeCookie('solarized')

    expect(readThemePreference()).toBe(ThemePreference.System)
  })

  it('defaults to system rather than throwing on a malformed percent-escape', () => {
    // '%2' is a truncated escape: `decodeURIComponent` raises a URIError on it. Left
    // unhandled that would propagate out of the mount effect and blank the screen over
    // a cosmetic preference.
    setThemeCookie('%2')

    expect(() => readThemePreference()).not.toThrow()
    expect(readThemePreference()).toBe(ThemePreference.System)
  })
})
