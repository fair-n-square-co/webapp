import { createFileRoute } from '@tanstack/react-router'
import { Home } from '../components/Home'

// No loader: the session user Home renders is app-level state, primed by the `_app`
// layout's loader for every screen under the shell. A route file should export only
// `Route`; the component lives in `components/`, free of route/data coupling.
export const Route = createFileRoute('/_app/')({
  component: Home,
})
