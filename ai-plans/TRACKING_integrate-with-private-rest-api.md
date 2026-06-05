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

## Current Phase

- **Phase 0d — Shared DataTable composition** (Tier 3, `claude-sonnet-4-6`) — starting.

## Remaining Phases

0d, 0e, 0f (foundation); 1–38 (use-cases).

## Deferred / Superseded

- **Phase 0b** — MSW mock layer — superseded (live API).
- **Phase 39** — mock→live swap — superseded (live API).
- No cross-repo phases. No flag-removal phase (no feature flag).
