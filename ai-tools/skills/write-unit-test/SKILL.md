---
name: write-unit-test
description: Write a unit test for a function, method, class, or module in vinta-schedule-frontend-web (Next.js 16 App Router + React 19 + TypeScript strict, Vitest + Testing Library, the vinta-schedule-design-system pnpm-workspace package) — mock only genuine externals, assert the full output (not counts/truthiness), clean up created data or roll back the transaction, never hit a service unavailable in dev/test, keep test logic literal, stay decoupled from internals. Applies this project's test preferences and the runner + stack packs for Vitest, React, and Next.js. Use on "add a test", "write a unit test", "cover this with tests", or when new behavior lands uncovered.
---

# Write a unit test

A test should fail when the behavior breaks and pass when it's correct — nothing more.

## Steps

1. **Read the unit's contract** — inputs, outputs, side effects, error paths. Test the contract, not the implementation.
2. **Match the nearest existing tests** — location, naming, helpers — unless they break a rule below.
3. **Load the packs** that shipped for this project — the test-**runner** pack (how to structure/assert/mock) plus the **stack** pack(s) matching what you're testing (DB isolation, framework client, domain mocks). Follow them alongside the rules:

   - **Runner** — [resources/packs/runners/vitest.md](resources/packs/runners/vitest.md). Always load it.
   - **Stack** — load the ones that match the unit under test:
     - [resources/packs/stacks/react.md](resources/packs/stacks/react.md) — any component, hook, or provider, in `src/` or in `packages/design-system/`.
     - [resources/packs/stacks/nextjs.md](resources/packs/stacks/nextjs.md) — App Router surface: server components, route handlers, `server-only` modules, middleware, `next/navigation` consumers.
     - A pure function or module with no React and no Next.js in its import graph needs the runner pack alone.

4. **Write it, then prove it.** Run in isolation (`pnpm vitest run <new-test-path>`) — green. Break the code (or invert an assertion), re-run — red for the right reason. Revert. Run the suite (`pnpm run test`; scope with `pnpm vitest run <path-or-pattern>` for the app, or `pnpm --filter vinta-schedule-design-system test` for the design system) — still green.

## Rules

1. **Mock only genuine externals** (third-party HTTP, payment/email/SMS, clock, randomness). Never mock the unit under test, its local collaborators, the DB, or your own pure functions.
2. **Assert the full value**, not counts or truthiness. `assert result`, `toBeTruthy()`, `len(x) == 3` are too weak. Assert contents and order for collections. **But don't over-fit brittle text** — for human-facing strings (error messages, UI copy, i18n) assert a stable anchor (an error code/type, a role, an i18n key, a substring), not the exact prose that churns.
3. **Leave no trace** — transaction-rollback harness where available; else clean up in teardown, and make teardown run on failure. Never depend on another test's data.
4. **No external service** that can't run in dev/test. Stub at the boundary.
5. **Test logic stays literal** — no loops/conditionals computing the expected value. Parametrize to cover cases; keep each expectation a literal.
6. **Decouple from internals** — assert observable state/output, not private methods or call counts. The test survives a behavior-preserving rewrite.
7. **One behavior per test**, named for what it pins (`returns_zero_for_empty_cart`).
8. **Kill nondeterminism** — control every entropy source (clock, randomness, timezone/locale, iteration/DB order, concurrency). Freeze/inject them; a test that passes only sometimes is worse than none.
9. **Cover the branches, not just the happy path** — aim high (95%+ branch coverage): each error path, guard, and edge (empty, boundary, null) gets a case. Coverage is the floor, correct assertions are the point.

## Project preferences

Apply these; `framework-default` defers to the pack. If the existing suite contradicts a preference, follow the preference for new tests and flag it — don't rewrite old tests.

| Preference | Value | What it means here |
|---|---|---|
| `test_style` | `framework-default` | Defer to the Vitest pack. The existing suite groups cases in a top-level `describe()` per unit, so match the file you're adding to. |
| `data_setup` | `inline` | Build test data in the test body, or in a small local helper at the top of the file (the `badRequest()` builder in [src/lib/allauth-form-errors.test.ts](../../../src/lib/allauth-form-errors.test.ts) is the shape). Promote it to a `*.fixtures.ts` file next to the source only once several test files need it. There is no factory library — don't introduce one for a single test. |
| `assertion_style` | `plain-assert` | Vitest `expect(...)`. |
| `db_isolation` | `framework-default` | No database in this repo — the frontend talks to an external API. Isolation means resetting module mocks and client-side state, not transactions. |

### Additional conventions

- **Colocate the test as `*.test.ts` / `*.test.tsx` next to the source file.** Both Vitest projects glob `**/*.{test,spec}.{ts,tsx}`; there are no `__tests__/` directories anywhere in the repo, so don't start one.
- **Two Vitest projects; `pnpm run test` runs both.** The root config covers `src/**`; `packages/design-system` has its own `vitest.config.ts` and its own `vitest.setup.ts`. A design-system test runs under the design-system config — check that setup file, not the root one, when a global is missing. Scope a run with `pnpm vitest run <path-or-pattern>` (app) or `pnpm --filter vinta-schedule-design-system test` (design system).
- **Mock with `vi.mock` at module scope, then `vi.clearAllMocks()` in `beforeEach`.** Import the real module under test; mock only genuine externals at the boundary (`sonner`, the generated API client, `next/navigation`). This is the idiom in the 99 test files that mock anything.
- **Global cleanup already runs — don't re-implement it.** The root `vitest.setup.ts` has an `afterEach` that calls Testing Library `cleanup()`, clears `localStorage`, and expires every cookie. It also polyfills `ResizeObserver`, `document.elementFromPoint`, and `Element.prototype.scrollIntoView` for jsdom. Add teardown only for state your test created outside those.

## Pitfalls

- Asserting on a mock you set up — tests the mock, not the code.
- Giant snapshots as a substitute for asserting the fields that matter.
- `delete all rows` in setup instead of rollback — masks leaked state, races other tests.
- Testing the framework/ORM/language instead of your behavior on top of it.
