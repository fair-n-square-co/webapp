# webapp

Fair n Square frontend — **React + TanStack Start** (SSR), which also serves as the
**BFF**: it holds the WorkOS session and calls the Go services over connectRPC
(ADR-4 / ADR-5). This is the re-scaffold off SvelteKit (ADR-5).

**Stack:** Bun · TanStack Start (SSR) + TanStack Router (file-based routes) · Vite 8 ·
TypeScript (strict) · React 19

## Develop

```sh
export GITHUB_TOKEN=...   # a PAT with `read:packages` — see below
bun install
cp .env.example .env      # then fill in the WorkOS values
bun run dev               # http://localhost:3000  (SSR + HMR)
```

The generated API clients ship as `@fair-n-square-co/apis` on GitHub Packages, which is
private, so `bun install` needs `GITHUB_TOKEN` set to a PAT with `read:packages` — without
it the install 401s. [`.npmrc`](./.npmrc) points the scope at that registry and reads the
token from the environment, so no credential is ever committed.

Routes live in `src/routes/`, shared UI in `src/components/`.

The auth routes need the `WORKOS_*` and `AUTH_SERVICE_BASE_URL` variables in
[`.env.example`](./.env.example); the rest of the app runs without them, since the config is
read per-request rather than at boot.

| Script | What |
| --- | --- |
| `bun run dev` | Dev server (SSR) on :3000 |
| `bun run build` | Production client + server build → `dist/` |
| `bun run typecheck` | `tsc --noEmit` (strict) |
| `bun run lint` | ESLint (type-aware + Rules of Hooks) |
| `bun run format:check` | Prettier check |
| `bun run test` | Vitest — components (jsdom, RTL, MSW) |
| `bun run test:e2e` | Playwright — SSR + hydration against the real app |

`bun install` installs a pre-commit hook that keeps the generated route tree in sync.
Conventions, testing strategy, and architecture rules live in [`AGENTS.md`](./AGENTS.md);
code style lives in [`docs/coding-standards/react-typescript.md`](./docs/coding-standards/react-typescript.md).

## Endpoints

- `/` — walking-skeleton landing page.
- `/healthz` — liveness for the ALB target group (200 = server up + SSR renders).

Auth (server-only handlers; no client bundle, no component):

- `GET /auth/login` — issues an OAuth `state` cookie, redirects to WorkOS AuthKit (Google).
- `GET /auth/callback` — verifies `state`, exchanges the code, provisions the canonical
  user, then seals the session cookie.
- `POST /auth/logout` — clears the session cookie, redirects to the WorkOS logout URL.
  POST, not GET: a GET logout is CSRF-able and gets triggered by link prefetchers.

The browser only ever holds an opaque, sealed, `httpOnly` cookie. It is unsealed solely
on the server, which is where the WorkOS access token is read before being forwarded to
the Go services.

The callback is also where the BFF makes its first connectRPC call: `IdentityService.
ResolveUser` on the auth service, which JIT-provisions the canonical user on first login
and returns the existing one on every login after. The access token travels in
`Authorization` metadata and only the email is in the body (ADR-4: the service trusts the
token, not the request fields). The cookie is set **after** that call succeeds — a visitor
with a WorkOS session but no canonical user is half-authenticated, so a provisioning
failure yields a 503 and a retry, never a broken session.

## Docker

```sh
docker build --secret id=github_token,env=GITHUB_TOKEN -t fns-webapp .
docker run -p 3000:3000 fns-webapp
```

The build needs `GITHUB_TOKEN` for the same reason `bun install` does. It is passed as a
BuildKit secret rather than a build arg so it never lands in the image history.

The image runs the **dev server** — "good enough for docker-compose" local bring-up
(FNS-90). A production multi-stage build with proper SSR client-asset serving is
**FNS-111**: `bun run build` emits a Web `fetch` handler (`dist/server/server.js`)
that needs a hosting adapter to inject the client manifest and serve `dist/client`.

## Roadmap (this scaffold = FNS-138)

- **FNS-91** — WorkOS AuthKit login + session in the BFF. Login, callback, logout and the
  sealed session cookie are done; JIT-provisioning the canonical user via
  `IdentityService.ResolveUser` is still to come, and waits on the `apis` TS package
  being published to GitHub Packages.
- **FNS-94** — profile view/edit/preferences, consuming `authx.ProfileService` (FNS-93, done).
- **FNS-111** — production multi-stage Docker build + SSR asset serving.
