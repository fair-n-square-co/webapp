import { createFileRoute } from '@tanstack/react-router'
import { Home } from '../components/Home'

// A route file should export only `Route`. Anything else it exports is pulled out
// of the route's lazy chunk, and the router warns about it. Keeping the component
// in `components/` also keeps it free of route/data coupling and directly testable.
export const Route = createFileRoute('/_app/')({
  component: Home,
})
