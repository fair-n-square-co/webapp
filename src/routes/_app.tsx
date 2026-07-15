import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AppShell } from '../components/AppShell'

// Pathless layout (the `_app` prefix adds no URL segment): it wraps the app's
// screens in the navigation chrome. Bare endpoints that should not have chrome —
// `/healthz`, the server-only `/auth/*` handlers — sit outside it.
export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
