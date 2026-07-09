import { createFileRoute } from '@tanstack/react-router'

// Liveness endpoint for the ALB target group. A 200 here means the server is up
// and the SSR pipeline can render. If we later need a plain-text/JSON body with
// no HTML shell, move this into a custom server entry (createStartHandler).
export const Route = createFileRoute('/healthz')({
  component: Health,
})

function Health() {
  return <pre>ok</pre>
}
