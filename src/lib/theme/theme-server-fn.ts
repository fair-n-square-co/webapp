import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { parseThemePreference, THEME_COOKIE_NAME } from './theme'
import type { ThemePreference } from './theme'

/**
 * Read the appearance preference from the cookie, on the server, so the root loader
 * can stamp `data-theme` into the SSR markup. Reading the cookie is server-only work
 * (`getCookie`), so it lives behind a server function rather than in the isomorphic
 * loader body.
 */
export const getThemePreference = createServerFn({ method: 'GET' }).handler((): ThemePreference =>
  parseThemePreference(getCookie(THEME_COOKIE_NAME)),
)
