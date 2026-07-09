# React + TypeScript Coding Standards

Instructions for writing React and TypeScript code in this repo. Follow these every time.
Rules are grouped so you can jump to what you need. When two rules seem to conflict,
prefer **type safety** and **the official Rules of React** over convenience.

> Stack note: this app is **TanStack Start (SSR + BFF)**, not Next.js. Where a rule mentions
> "server vs. client components" or "server functions", read it in TanStack Start terms.
> Sources are listed at the bottom; every rule traces to an authoritative one.

---

## 1. TypeScript — types & safety

- **Never use `any`.** If a value is genuinely unknown, use `unknown` and narrow it before use.
  Reserve `as any` / `as unknown as T` for true edge cases and justify them in a comment.
- **No `@ts-ignore` / `@ts-expect-error`** without a comment explaining why. Prefer fixing the type.
- **Enable `strict` mode** in `tsconfig.json` (plus `noUncheckedIndexedAccess`). Treat type errors as build failures.
- **Prefer inference over annotation** for locals where the type is obvious. Annotate explicitly only
  when narrowing is needed.
- **Always give explicit return types** to exported/public functions and hooks — it documents intent
  and prevents accidental widening.
- **Prefer `type` aliases** for most shapes; use `interface` when you need declaration merging
  (e.g. augmenting a third-party type). Be consistent within a file.
- **Avoid `enum`** — it emits runtime code and has surprising semantics. Use a union of string literals
  or an `as const` object instead:
  ```ts
  const Status = { Idle: 'idle', Loading: 'loading', Error: 'error' } as const;
  type Status = (typeof Status)[keyof typeof Status];
  ```
- **Use `as const` (or `as const satisfies T`)** for literal config/constants to keep them immutable and narrowly typed.
- **Model mutually-exclusive state with discriminated unions**, not a bag of optional booleans.
  Replace `{ isLoading; isError; data? }` with:
  ```ts
  type Result<T> =
    | { status: 'loading' }
    | { status: 'error'; error: Error }
    | { status: 'success'; data: T };
  ```
  Use a `switch` on the discriminant with an exhaustiveness check (`assertNever`) so new cases fail at compile time.
- **Prefer immutable data.** Use `readonly` / `ReadonlyArray<T>` on props and shared data; return new
  objects/arrays instead of mutating.
- **Functions: prefer a single object argument** when there are 3+ params or any booleans, so call sites are self-documenting.
- **Prefer required parameters over optional ones**; encode "either/or" with a discriminated union rather than many optionals.

## 2. TypeScript — naming & modules

- `camelCase` for variables/functions, `PascalCase` for types & components, `UPPER_CASE` for true constants.
- Boolean names get an affirmative prefix: `is`, `has`, `should`, `can`, `will` (`isDisabled`, `hasAccess`).
- Prop types are named `ComponentNameProps`. Hooks are `useSomething`. Generic params are `PascalCase` starting with `T` (`TRequest`).
- **Prefer named exports** over default exports (better refactors, autocomplete, and consistent import names).
  A file whose whole job is one component/route may use a default export if a framework convention requires it.
- **Use `import type { … }`** for type-only imports so they're erased and don't affect runtime/bundling.

## 3. React — the Rules of React (non-negotiable)

- **Components and hooks must be pure.** Same inputs (props/state/context) → same JSX. No side effects,
  no mutation, no randomness/`Date.now()` during render.
- **Never mutate props, state, or hook arguments/return values.** They are immutable snapshots. Copy first.
- **Do all side effects outside render** — in event handlers or `useEffect`, never in the render body.
- **Only call hooks at the top level** of a component or another hook. Never in loops, conditions, or nested functions.
- **Only call hooks from React functions** (components or custom hooks), never from plain functions.
- **Render components as JSX** (`<Foo />`), never call them like functions (`Foo()`).
- Enforce these with `eslint-plugin-react-hooks` and run in **StrictMode** during development.

## 4. React — components & props

- **Type props with an explicit `type`/`interface`; don't use `React.FC`.** Declare the function and type its props:
  ```tsx
  type ButtonProps = { label: string; onClick: () => void; children?: React.ReactNode };
  export function Button({ label, onClick, children }: ButtonProps) { … }
  ```
- **`children` is `React.ReactNode`.** For a component that renders an element, prefer specific types (`React.ReactElement`) only when you truly need them.
- **Keep components small and single-purpose.** Extract sub-components rather than growing one file.
- **Lift state only as far as it needs to go**; keep it local when possible. Derive values during render instead of storing derived state.
- **Use stable, meaningful `key`s** in lists (an entity id, never the array index when items can reorder/insert).
- **Type events with React's synthetic event types**, e.g. `React.ChangeEvent<HTMLInputElement>`, `React.MouseEvent<HTMLButtonElement>` — not the DOM globals.

## 5. React — hooks

- **`useEffect` is an escape hatch, not the default.** Don't use it for: transforming data for render
  (do it during render), responding to user events (use handlers), or syncing state you could derive.
  Reach for it only to synchronize with external systems.
- **Give every effect a correct, complete dependency array**; don't silence the linter. If deps churn,
  fix the source (memoize, move it, or restructure) rather than removing them.
- **Each hook has one concern.** Extract reusable stateful logic into custom hooks (`useX`) instead of duplicating.
- **`useState` typing:** let it infer from the initial value; annotate the generic only when the initial value
  doesn't capture the type — e.g. `useState<User | null>(null)`.
- **`useRef` typing:** for DOM nodes use `useRef<HTMLInputElement>(null)` and pass to `ref`. For mutable
  instance values, type the generic to the stored value.
- **State setters passed to children** are typed `React.Dispatch<React.SetStateAction<T>>`.
- **Custom hooks returning >2 values should return an object**, not a tuple, so call sites name fields.

## 6. React — performance

- **Prefer the React Compiler / correct structure over manual memoization.** Measure before optimizing.
- Reach for `useMemo` / `useCallback` / `React.memo` only for a proven hot path (expensive compute or a
  referential-identity problem causing real re-renders) — not by default.
- **Data fetching, caching, and server state belong in TanStack Query / router loaders**, not ad-hoc `useEffect` + `useState`.
- Split code and lazy-load (`React.lazy` / route-level splitting) for large, rarely-used views.
- Use `<Suspense>` boundaries to stream and progressively reveal UI instead of blocking on the whole tree.

## 7. Architecture (TanStack Start)

- **Do interactive work on the client, keep static/data-heavy work on the server.** Only make a component
  a client island when it needs browser APIs, state, or event handlers; keep those islands small.
- **Keep the BFF boundary honest:** validate and type all data crossing the server↔client boundary
  (e.g. with `zod` / `valibot`); never trust an inferred shape from an untyped fetch. Type server function inputs and outputs.
- **Colocate route logic with routes** (loaders/actions), and keep shared UI in a `components/` layer with no route/data coupling.

## 8. Tooling & quality gates

- **ESLint** with `@typescript-eslint` (type-aware rules) + `eslint-plugin-react-hooks`, and **Prettier** for
  formatting (run Prettier last so it doesn't fight lint rules).
- **Run lint, typecheck, and tests before every commit** (wire them into CI and a pre-commit hook).
- Fix type/lint errors properly instead of suppressing them.

## 9. Testing strategy & frameworks

**Philosophy — the Testing Trophy, not the pyramid.** Write mostly **integration** tests (a component or
feature with its real collaborators, only the network mocked), fewer unit tests, and a thin layer of E2E.
"The more your tests resemble the way your software is used, the more confidence they give you." Optimize
for confidence per line of test, not raw coverage numbers.

**Frameworks (standardize on these):**

| Layer | Tool | Use it for |
| --- | --- | --- |
| Test runner | **Vitest** | Unit + integration; native ESM/TS, Vite-shared config, `expectTypeOf` for type tests |
| Component tests | **React Testing Library** + `@testing-library/user-event` | Rendering, user interaction, accessibility-first queries |
| Network mocking | **MSW (Mock Service Worker)** | Intercept HTTP at the network layer — same handlers in tests and dev |
| E2E / browser | **Playwright** | Critical user journeys across the real SSR app, auth flows, cross-browser |

**Rules:**

- **Test behavior, not implementation.** Assert on what the user sees/does, never on state, props, or
  internal function calls. If a refactor that preserves behavior breaks a test, the test was wrong.
- **Query by accessibility.** Prefer `getByRole` / `getByLabelText` / `getByText`; use `getByTestId` only as
  a last resort. This doubles as an a11y check.
- **Drive interaction with `user-event`, not `fireEvent`** — it models real user behavior (focus, key events).
- **Mock at the network boundary with MSW**, not by stubbing modules/hooks. Keeps tests honest about the BFF contract.
  Don't mock what you own; only mock external services and the network.
- **Prefer `findBy*` / `waitFor` for async**; never assert immediately after an interaction that triggers a fetch.
- **One behavior per test.** Descriptive names stating the behavior: `it('shows an error when the request fails')`.
  Arrange–Act–Assert structure.
- **Write a test for every bug fix** that reproduces the bug first (red → green). Write tests alongside new features.
- **Type-level tests** for tricky generics/utility types with `expectTypeOf` (Vitest) or `expect-type`.
- **E2E is for critical paths only** (login, core transaction flows) — they're slow and flakier, so keep them few and stable.
- **Tests must be deterministic:** no real network, no real clock/`Date.now()` (inject or fake timers), no shared
  mutable state between tests. A flaky test is a failing test — fix or delete it.
- **Test the server/BFF boundary too:** unit-test server functions/loaders and validation (zod/valibot) schemas directly.
- **Don't chase 100% coverage.** Cover logic and edge cases; skip trivial glue. Coverage is a smell detector, not a goal.

---

## Quick checklist (paste into PR review)

- [ ] No `any`; `unknown` narrowed; no un-justified `@ts-*` suppressions
- [ ] Explicit return types on exported functions/hooks
- [ ] Mutually-exclusive state modeled as a discriminated union, exhaustively handled
- [ ] Props typed with a named `*Props` type; no `React.FC`; `children: React.ReactNode`
- [ ] Components/hooks pure; no mutation of props/state; side effects only in handlers/effects
- [ ] Hooks called at top level only; effect deps complete and honest
- [ ] `useEffect` justified (external sync) — not used for derivable/derived state
- [ ] Server state via TanStack Query/loaders, not `useEffect`+`useState`
- [ ] Data crossing the BFF boundary validated and typed
- [ ] Behavior-focused tests added (accessibility queries, `user-event`, MSW at the network boundary)
- [ ] Bug fixes include a regression test; async assertions use `findBy*`/`waitFor`
- [ ] Lint + typecheck + tests pass

---

## Sources

- [Rules of React — react.dev](https://react.dev/reference/rules)
- [React v19 release notes — react.dev](https://react.dev/blog/2024/12/05/react-19)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/) ([repo](https://github.com/typescript-cheatsheets/react))
- [TypeScript Style Guide — mkosir](https://mkosir.github.io/typescript-style-guide/)
- [ts.dev TypeScript style guide (Google-based)](https://ts.dev/style/)
- [typescript-eslint](https://typescript-eslint.io/)
- [TypeScript for React Developers: common mistakes — GreatFrontend](https://www.greatfrontend.com/blog/typescript-for-react-developers)
- [React & TypeScript patterns — LogRocket](https://blog.logrocket.com/react-typescript-10-patterns-writing-better-code/)
- [Testing Library — guiding principles](https://testing-library.com/docs/guiding-principles/)
- [The Testing Trophy — Kent C. Dodds](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- [Common mistakes with React Testing Library — Kent C. Dodds](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Vitest](https://vitest.dev/) · [Playwright](https://playwright.dev/) · [MSW](https://mswjs.io/)
