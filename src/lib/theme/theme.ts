/**
 * SSR-safe appearance handling.
 *
 * The POC read `localStorage` at module scope and set `data-theme` from the client
 * only. Under SSR that is a hydration mismatch waiting to happen: the server renders
 * one theme, the client's first paint another. Here the source of truth is a cookie
 * the server can read, so the server stamps `data-theme` on `<html>` and the client
 * agrees on first paint. Nothing in this module touches `window`/`localStorage` at
 * module scope — the one place that reads the browser is a string handed to a
 * pre-paint inline script (see {@link themeInitScript}).
 */

/** What the user picked. `system` defers to the OS `prefers-color-scheme`. */
export const ThemePreference = {
  System: 'system',
  Light: 'light',
  Dark: 'dark',
} as const
export type ThemePreference = (typeof ThemePreference)[keyof typeof ThemePreference]

/** The concrete theme actually applied — what `data-theme` is ever set to. */
export type ResolvedTheme = 'light' | 'dark'

export const THEME_COOKIE_NAME = 'fns_theme'

export function parseThemePreference(value: string | undefined): ThemePreference {
  return value === ThemePreference.Light || value === ThemePreference.Dark
    ? value
    : ThemePreference.System
}

/**
 * Resolve the theme the server should stamp for a given preference. The server
 * cannot read the device's `prefers-color-scheme`, so `system` renders as `light`;
 * {@link themeInitScript} then corrects a `system` visitor on a dark device before
 * first paint. An explicit `light`/`dark` preference resolves to itself, so those
 * visitors get an exact match with zero correction.
 */
export function resolveThemeOnServer(preference: ThemePreference): ResolvedTheme {
  return preference === ThemePreference.Dark ? 'dark' : 'light'
}

/**
 * A tiny script inlined into `<head>` and run before first paint. It reads the same
 * cookie the server did and, for a `system` preference, consults the live media
 * query — the one thing the server could not — so a dark-device visitor never sees a
 * light flash. For an explicit preference it re-affirms what the server already
 * stamped. Kept dependency-free because it runs as a bare string, ahead of the bundle.
 */
export function themeInitScript(cookieName: string): string {
  return `(function(){try{
var m=document.cookie.match(/(?:^|; )${cookieName}=([^;]*)/);
var p=m?decodeURIComponent(m[1]):'system';
var dark=p==='dark'||(p!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.dataset.theme=dark?'dark':'light';
}catch(e){}})();`
}

// A year: the appearance choice is a durable preference, not a session value.
const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

/**
 * Read the appearance preference the browser persisted. Client-only — it touches
 * `document.cookie`, so callers must guard for SSR (there is no `document` there). An
 * absent or unrecognised cookie means "system".
 */
export function readThemePreference(): ThemePreference {
  const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE_NAME}=([^;]*)`))
  const raw = match?.[1]
  return parseThemePreference(raw ? decodeURIComponent(raw) : undefined)
}

/**
 * Persist the appearance choice and apply it immediately, in the browser. Appearance
 * is client-only (a cookie plus `data-theme`), never a server profile preference: the
 * cookie lets the server stamp the right theme on the next SSR, and stamping
 * `data-theme` now repaints without a round-trip. For "system" the live media query —
 * the one thing the server cannot read — decides the concrete theme. Client-only:
 * touches `document`/`window`, so it must run only from an event handler on the client.
 */
export function applyThemePreference(preference: ThemePreference): void {
  document.cookie = `${THEME_COOKIE_NAME}=${encodeURIComponent(preference)}; path=/; max-age=${THEME_COOKIE_MAX_AGE_SECONDS}; samesite=lax`
  const dark =
    preference === ThemePreference.Dark ||
    (preference !== ThemePreference.Light &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset['theme'] = dark ? 'dark' : 'light'
}
