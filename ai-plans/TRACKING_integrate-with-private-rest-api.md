# Tracking — Integrate with private REST API

- **Plan**: [2026-06-05-INTEGRATE_WITH_PRIVATE_REST_API_IMPLEMENTATION_PLAN.md](2026-06-05-INTEGRATE_WITH_PRIVATE_REST_API_IMPLEMENTATION_PLAN.md)
- **Started**: 2026-06-05
- **Last updated**: 2026-06-05
- **Feature flag**: none (additive surface)
- **Branch pattern**: `plan/integrate-with-private-rest-api/phase-{id}`, stacked
- **run_options**: `pause_between_phases: false` (auto-flow), `generate_inline_comments: true`, `scope: all 44 executable phases`

## Baseline

- Backend shipped all endpoints; `schema.yml` updated, `src/client/` regenerated.
- Plan amended 2026-06-05: MSW mock layer dropped; **Phase 0b** and **Phase 39** superseded (retired ids).
- Baseline commit `7a6f817` on `phase-0a` branch (plan + schema + client regen + gitignore).

## Completed Phases

### Phase 0a — App shell, routing & role gating ✅

- **Status**: done, PR opened.
- **Model**: `claude-sonnet-4-6` (plan Tier 3).
- **Branch**: `plan/integrate-with-private-rest-api/phase-0a` (base `main`).
- **PR**: https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/1 (6 inline comments).
- **Commits**: `72f5aa1` baseline (client regen + plan amendment), `4e16f50` phase code, `140a72c` lint/format ignores, `ff51182` review fixes.
- **E2E**: deferred to Phase 0f (Playwright harness lands there).
- **Summary**: `(app)` route group + thin server `layout.tsx` delegating to `AppLayoutClient` (auth bootstrap via localStorage mirroring `OnboardingGate`). `RoleProvider`/`RoleGate` (exact match) + `useRequireRole` (degrade-don't-loop, default `/`). Disabled-user gating extended into `useCurrentOrganization`: 403 → typed `{ status: 'disabled' }` sentinel surfaced as `isDisabled`; layout redirects disabled users to top-level `/no-access` (placed outside `(app)` to avoid a re-wrap loop). Dashboard placeholder. Independent review found 3 blockers (unreachable no-access, fragile 403 detection + test bypass, client root layout) — all fixed.
- **Gate**: typecheck/test(33)/lint(0 err)/format green. `npm run build` fails ONLY on pre-existing `/auth/verify-email` prerender crash (input-otp SSR), untouched by this phase — flagged to the user.
- **Tooling added this phase**: `.prettierignore` + eslint ignore for generated clients & `storybook-static`; format scripts wired to `.prettierignore`.

### Phase 0c — Luxon date & timezone utilities ✅

- **Status**: done, PR opened.
- **Model**: `claude-sonnet-4-6` (plan Tier 3).
- **Branch**: `plan/integrate-with-private-rest-api/phase-0c` (base `phase-0a`, stacked).
- **PR**: https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/2 (5 inline comments).
- **Commits**: `6000d27` datetime lib + RRULE serde, `babd23c` review fixes.
- **Summary**: `src/lib/datetime/` — `zonedFormat`, `eventRange`, `toApiRange`, `weekdayMatrix`, DST helpers (`isInDstFallBack`, `isInDstSpringForwardGap`, `dstStatus`). `date-utils.ts` migrated to Luxon with byte-identical output (parity test added). `RecurrenceRule` RFC-5545 subset + round-trippable `serializeRRule`/`parseRRule` (UNTIL>COUNT precedence). Review (FIX-FIRST) fixed: dstStatus mislabeling fixed-offset zones, formatDateTime Intl parity, `@types/luxon`→devDeps, list-view 7-day window, gap-helper coverage.
- **Gate**: typecheck/test(102)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.
- **Note**: `isInDstSpringForwardGap` flags the pre-transition window (Luxon normalizes the gap) — documented + tested.

### Phase 0d — Shared DataTable composition ✅

- **Status**: done, PR opened.
- **Model**: `claude-sonnet-4-6` (plan Tier 3).
- **Branch**: `plan/integrate-with-private-rest-api/phase-0d` (base `phase-0c`, stacked).
- **PR**: (see below) — inline comments.
- **Commits**: `0926de8` DataTable composition, `18a9333` review fixes.
- **Summary**: shadcn `table` atom added; `src/components/data-table/` — generic fully-controlled `DataTable<T>` (TanStack Table v8 in `manualSorting`/`manualPagination`/`manualFiltering`, `enableMultiSort:false`), `data-table-toolbar` (debounced search), `data-table-pagination` (wraps shadcn Pagination), `useDataTableQuery` hook syncing `page`/`page_size`/`ordering`/`search` to URL params + `DataTableQueryBoundary` (Suspense wrapper for Next 16 `useSearchParams`). Skeleton loading + empty-state slot. `DataTableColumn<T>`/`DataTableQuery` types. Consumed by phases 1,2,7,11,28,30,37. Review (FIX-FIRST) fixed: pagination interaction + skeletonRows tests, layout primitives, a11y tabIndex, Suspense hardening.
- **Gate**: typecheck/test(120)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 0e — Calendar infrastructure (list / month / week) ✅

- **Status**: done, PR opened.
- **Model**: `claude-sonnet-4-6` (plan Tier 3).
- **Branch**: `plan/integrate-with-private-rest-api/phase-0e` (base `phase-0d`, stacked).
- **PR**: (published below) — inline comments.
- **Commits**: `10d68f1` calendar wrapper, `b7179d2` review fixes.
- **Summary**: `src/components/calendar/` — `CalendarView` (react-big-calendar + `luxonLocalizer`, agenda/month/week), `event-vm.ts` (`CalendarEventVM`: JS Date for RBC grid + zoned Luxon `DateTime` + per-event tz label + typed `ApiRecurrenceRule`), `calendar-theme.css` (RBC themed to design tokens, no raw hex), `calendar-scope-picker` scaffold, `eventRenderer` render-prop hook point for Phase 18 overlays. Review (FIX-FIRST) fixed: typed recurrence (was stringified), 3 dark-mode color leaks, DST-winter label test, inline-style→primitives, `@types`→devDeps, scope-picker story.
- **Spike**: RBC integrates cleanly via `components.event`; Phase 18 may need `eventWrapper` for pixel-positioned availability overlays — flagged forward.
- **Gate**: typecheck/test(147)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 0f — E2E harness & QA use-cases doc ✅
- **Status**: done, PR opened.
- **Model**: `claude-sonnet-4-6` (plan suggested Tier 2; tiered up — auth fixture flagged fiddly).
- **Branch**: `plan/integrate-with-private-rest-api/phase-0f` (base `phase-0e`, stacked).
- **PR**: (published below) — inline comments.
- **Commits**: `7782f3e` e2e harness + QA doc + smoke.
- **Summary**: `@playwright/test`, `playwright.config.ts` (webServer → `npm run dev` w/ `NEXT_PUBLIC_API_BASE_URL`, live API), `e2e/` (page-object base, member+admin auth-bypass fixture seeding `localStorage.accessToken` to match Phase 0a's gate, `PR000-smoke` spec, `collect-screenshots.mjs`, `e2e/README.md`, separate tsconfig). `QA_USE_CASES.md` — 38 use-cases (24 PR + 14 PA) + PR000. `e2e/**` eslint-ignored; gitignore += test-results/playwright-report/.playwright.
- **Honest run status**: harness correct-by-construction but NOT run-green in sandbox — needs live API URL + real `E2E_*_ACCESS_TOKEN` JWTs. Documented in `e2e/README.md`.
- **Review**: focused orchestrator deep-read of the auth fixture against the actual Phase 0a gate (config/doc/test-harness phase, no production code) — fixture seeds the correct key; accepted.
- **Gate**: typecheck/Vitest(147, e2e excluded via `src/**` include)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

## Foundation complete ✅ (0a, 0c, 0d, 0e, 0f — 0b superseded)

## Current Phase

- **Phase 1 — List team (admin)** (Tier 2) — starting use-case phases.

## Remaining Phases

1–38 (use-cases).

## Deferred / Superseded

- **Phase 0b** — MSW mock layer — superseded (live API).
- **Phase 39** — mock→live swap — superseded (live API).
- No cross-repo phases. No flag-removal phase (no feature flag).
