# End-to-end tests

Playwright against the real SSR app. These are the **only** tests that exercise SSR and
hydration — jsdom does neither — so they guard the core architectural bet: the server
ships real HTML and the client bundle hydrates it without errors. Critical paths only
(coding standards §9); breadth of behaviour belongs in the Vitest/RTL layer.

## Layout

Directories follow the UI, so finding the specs for a screen means opening the folder
named after it.

```
e2e/
├── fixtures/     shared helpers + the warmup project (not specs)
├── screens/      one directory per screen a user can land on
│   ├── home/
│   ├── profile/
│   ├── not-found/
│   └── signin-failed/
├── shell/        chrome present on every screen (navigation, appearance)
├── auth/         server-only flows, not screens (login, callback, logout)
└── infra/        operational endpoints (healthz)
```

## What is covered

| Area | Behaviour | Where |
| --- | --- | --- |
| Home | Server-renders before any JS; hydrates clean | `screens/home/` |
| Not found | 404 status + real page; exactly one shell; link home | `screens/not-found/` |
| Sign-in failed | Server-renders; offers a retry | `screens/signin-failed/` |
| Profile | Anonymous visitor redirected; no markup leaks | `screens/profile/access-control.spec.ts` |
| Shell | Anonymous sidebar; client-nav into the login flow; nav on every screen | `shell/navigation.spec.ts` |
| Appearance | Server stamps `data-theme`; pre-paint correction on a dark device; malformed cookie is survivable | `shell/appearance.spec.ts` |
| Auth | Authorize URL + state cookie; the three callback rejections; logout redirect | `auth/` |
| Infra | Liveness probe | `infra/healthz.spec.ts` |

## What is NOT covered, and why

**Every signed-in behaviour is absent.** The suite runs hermetically: `playwright.config.ts`
supplies placeholder WorkOS credentials and points `AUTH_SERVICE_BASE_URL` at a port
nothing listens on. Nothing here can mint a session, so no spec has ever rendered a
screen as a logged-in user.

Concretely, these have **no e2e coverage at all**:

- The profile read view (identity card, currency, the "not set yet" username state)
- Profile edit mode: opening it, validation, saving, the taken-username/email conflicts,
  the retryable fault path, fields locking during a save
- The `AppearanceControl` segmented control itself — it renders only inside the gated
  profile screen, so only its *effects* (the `data-theme` stamping above) are reachable
- The signed-in shell: the account area and the sidebar log-out
- Logout with a real session (only the no-session POST is exercised)

These are covered at the component level (`ProfileScreen.test.tsx`) and at the wire
level (`profile-rpc.server.test.ts`), which is real coverage — but neither runs SSR or
hydration, so the integration between them is untested by anything.

Closing this needs a deliberate auth fixture: a stub JWKS endpoint so a self-signed
access token verifies, a sealed `fns_session` cookie minted with the same cookie
password the BFF uses, and a stub Connect server standing in for the Go auth service.
That is its own piece of work, not a tweak to these specs.

## Running

```bash
bunx playwright install chromium   # first run only
bun run test:e2e
```

The `warmup` project runs first and absorbs `vite dev`'s initial dependency
optimization, which would otherwise land mid-spec on a cold CI runner. See
`fixtures/warmup.setup.ts`.
