import { createFileRoute } from '@tanstack/react-router'
import { SignInFailed } from '../components/SignInFailed'

// Under the `_app` layout so it inherits the shell and nav. The OAuth callback
// redirects here when it authenticates a visitor but cannot provision their user.
export const Route = createFileRoute('/_app/signin-failed')({
  component: SignInFailed,
})
