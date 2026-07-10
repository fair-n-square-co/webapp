# webapp

Fair n Square frontend — **React + TanStack Start** (SSR), which also serves as the
**BFF**: it holds the WorkOS session and calls the Go services over connectRPC
(ADR-4 / ADR-5). This is the re-scaffold off SvelteKit (ADR-5).

**Stack:** Bun · TanStack Start (SSR) + TanStack Router (file-based routes) · Vite 8 ·
TypeScript (strict) · React 19

## Develop

```sh
bun install
cp .env.example .env   # then fill in the WorkOS values
bun run dev            # http://localhost:3000  (SSR + HMR)
```

Routes live in `src/routes/`, shared UI in `src/components/`.

The auth routes need the `WORKOS_*` variables in [`.env.example`](./.env.example); the rest
of the app runs without them, since the config is read per-request rather than at boot.

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
- `GET /auth/callback` — verifies `state`, exchanges the code, seals the session cookie.
- `POST /auth/logout` — clears the session cookie, redirects to the WorkOS logout URL.
  POST, not GET: a GET logout is CSRF-able and gets triggered by link prefetchers.

The browser only ever holds an opaque, sealed, `httpOnly` cookie. It is unsealed solely
on the server, which is where the WorkOS access token is read before being forwarded to
the Go services.

## Docker

```sh
docker build -t fns-webapp .
docker run -p 3000:3000 fns-webapp
```

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
