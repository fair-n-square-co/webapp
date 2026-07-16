# webapp — agent instructions

React + TanStack Start (SSR) frontend that also serves as the BFF (ADR-4/ADR-5).
Runtime/package manager: **Bun**. See `README.md` for how to run it.

## Coding standards

When writing or reviewing **any** TypeScript or React code in this repo, follow the standards in:

@docs/coding-standards/react-typescript.md

## Architecture

- **SSR is intentional** (ADR-2/ADR-5 BFF/SSR pattern): the server holds the WorkOS
  session and forwards the access token to the Go services over connectRPC. That is why
  a server exists at all — it enables auth-gating with no flash of unauthenticated
  content. Individual routes can drop to SPA mode via the plugin's `spa` option without
  touching the BFF.
- The `fns-ui-poc` repo is a **design/component reference only**. It says nothing about
  how this app is implemented.
- Keep shared UI in `src/components/` with no route or data coupling. Colocate loaders
  and actions with their routes.

## State management

Follow these conventions for every new page:

- **Server state lives in TanStack Query, primed by route loaders.** Each domain owns a
  query module in `src/lib/<domain>/` (e.g. `profile-query.ts`) exporting `queryOptions`
  and the server function behind them. The route loader `await`s
  `queryClient.ensureQueryData(...)` and returns nothing (returned data would be
  serialized into the loader payload too; the dehydrated query stream already carries
  it). The screen reads it back with `useSuspenseQuery`. Never fetch server state with
  `useEffect` + `useState`.
- **The signed-in user is app-level state.** The `_app` layout loader primes
  `sessionUserQueryOptions()` for every screen under the shell; any screen reads it with
  `useSuspenseQuery(sessionUserQueryOptions())`. New pages must not wire their own
  session fetch. Session-gated pages call server functions that `requireSession()`; the
  thrown redirect is the router's to handle. `getSession()` is memoized per request —
  parallel loaders share one resolution (a second concurrent refresh of the single-use
  refresh token would sign the visitor out).
- **A domain module follows the profile recipe:** `src/lib/<domain>/types.ts` (trusted
  shapes that already crossed the BFF boundary — no server-only imports),
  `<domain>-rpc.server.ts` (connectRPC client + wire validation, server-only), and
  `<domain>-query.ts` (the server-function + queryOptions seam). Shared RPC plumbing
  (transport, bearer-token interceptor) stays in `src/lib/rpc/`.
- **Error/not-found chrome:** route-level error boundaries render *inside* parent
  layouts, so `ErrorScreen` is shell-less (the `_app` shell is already around it). The
  global not-found renders at the root boundary, *above* `_app`, so `NotFound` wraps
  itself in `AppShell`. Don't swap those two arrangements.

## Generated files

`src/routeTree.gen.ts` is written by the TanStack Start Vite plugin during `vite dev`
and `vite build`. **Never hand-edit it.**

It is **committed** (and marked `linguist-generated` in `.gitattributes`) so a fresh
clone can `typecheck` without building first — CI runs `typecheck` before any build.
Three things keep the committed copy honest:

- `.githooks/pre-commit` regenerates it and rejects the commit if the staged copy is
  stale or untracked. `bun install` points `core.hooksPath` at `.githooks/`.
- CI rebuilds and fails if the committed tree differs.
- `vite.config.ts` sets `routeFileIgnorePattern` so colocated `*.test.tsx` files under
  `src/routes/` are never mistaken for routes.

Bypass the hook with `SKIP_HOOKS=1 git commit` or `git commit --no-verify`.

**A route file must export only `Route`.** Any other export is pulled out of the route's
lazy chunk and the router warns about it — put the component in `src/components/` and
import it.

## Testing

Follow the Testing Trophy (see the coding standards, §9). Concretely, in this repo:

- **Vitest + React Testing Library** (`src/**/*.test.tsx`) for components, next to the
  code they cover. MSW mocks the network boundary; `onUnhandledRequest: 'error'` means a
  stray real request fails the test rather than passing silently.
- **Playwright** (`e2e/`) for critical paths only. These are the **only** tests that
  exercise SSR and hydration — jsdom does neither — so they guard the core architectural
  bet: the server ships real HTML, and the client bundle hydrates it without errors.
  Assert server rendering with Playwright's `request` fixture (it runs no JavaScript, so
  any markup it sees came from the server).

Run `bun run typecheck && bun run lint && bun run format:check && bun run test` before
every commit. First E2E run needs browsers: `bunx playwright install chromium`.

## PR explainers (required for every PR)

The maintainer is learning React and TanStack, so **every PR gets a plain-language
explainer** describing what the PR did and why.

- **Location:** `~/workspace/fairnsquare/temp/react-explainers/` (personal, NOT committed
  to any repo).
- **One directory per PR**, namespaced by repo: `<repo>/PR-<number>/index.html`.
  For this repo that's `webapp/PR-<number>/index.html` (e.g. `webapp/PR-1/index.html`).
- **Format:** a self-contained HTML file. Link the shared stylesheet with the correct
  relative path (`../../styles.css` from a `<repo>/PR-<n>/` folder). Write for a reader
  new to React/TanStack: explain the concepts, not just the diff.
- **Required `<meta>` tags** (the home-page generator reads these):
  `explainer:repo`, `explainer:pr`, `explainer:title`, `explainer:date`,
  `explainer:summary`, `explainer:pr_url`.
- **After adding/editing an explainer, rebuild the home page:**
  `cd ~/workspace/fairnsquare/temp/react-explainers && node generate.mjs`.
  `index.html` there auto-populates from every explainer's meta tags — never hand-edit it.

Copy an existing explainer (e.g. `webapp/PR-1/index.html`) as the template for structure
and styling.
