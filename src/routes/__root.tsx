import type { ReactNode } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from '@tanstack/react-router'
import { resolveThemeOnServer, themeInitScript, THEME_COOKIE_NAME } from '../lib/theme/theme'
import type { ThemePreference } from '../lib/theme/theme'
import { getThemePreference } from '../lib/theme/theme-server-fn'
import '../styles.css'

/** Context every route receives — the shared QueryClient (see `getRouter`). */
export type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'Fair n Square' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Spline+Sans+Mono:wght@400;500;600;700&display=swap',
      },
    ],
  }),
  // Reads the appearance cookie on the server so the very first HTML carries the
  // right `data-theme`. See RootDocument for how `system` is reconciled before paint.
  loader: async (): Promise<{ themePreference: ThemePreference }> => ({
    themePreference: await getThemePreference(),
  }),
  component: RootComponent,
})

function RootComponent() {
  const { themePreference } = Route.useLoaderData()
  return (
    <RootDocument themePreference={themePreference}>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({
  children,
  themePreference,
}: Readonly<{ children: ReactNode; themePreference: ThemePreference }>) {
  // `suppressHydrationWarning`: the server stamps the theme it can compute, and the
  // inline script below may correct a `system` visitor to dark before React hydrates.
  // React would otherwise flag the attribute it rendered no longer matching the DOM.
  return (
    <html lang="en" data-theme={resolveThemeOnServer(themePreference)} suppressHydrationWarning>
      <head>
        {/* Runs before first paint, ahead of the bundle, so a dark-device visitor
            whose preference is "system" never sees a flash of the light theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript(THEME_COOKIE_NAME) }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
