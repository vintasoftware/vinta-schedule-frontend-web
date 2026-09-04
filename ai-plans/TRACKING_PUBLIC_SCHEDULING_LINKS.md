# Tracking — Public Scheduling Links

- **Plan**: [2026-09-04-PUBLIC_SCHEDULING_LINKS_IMPLEMENTATION_PLAN.md](2026-09-04-PUBLIC_SCHEDULING_LINKS_IMPLEMENTATION_PLAN.md)
- **Started**: 2026-09-04
- **Last updated**: 2026-09-04
- **Feature flag**: none — the plan treats this as additive surface (see its **Guiding Decisions**).

## Run options

| Option                     | Value                                                             |
| -------------------------- | ----------------------------------------------------------------- |
| `pause_between_phases`     | `false`                                                           |
| `generate_inline_comments` | `false`                                                           |
| `full_test_suite`          | `false` (scoped)                                                  |
| `run_e2e`                  | `false`                                                           |
| `commit_strategy_resolved` | `stacked-branches`                                                |
| `use_worktree`             | `true`                                                            |
| `worktree_path`            | `.claude/worktrees/plan-public-scheduling-links`                  |
| `worktree_branch`          | `plan-public-scheduling-links` (based on `8f1d151`)               |
| `worktree_summary`         | `.vinta-ai-workflows/worktrees/plan-public-scheduling-links.yaml` |
| `sandbox_tier`             | `enforced` (`sandbox-exec`)                                       |

**Agent models** (from `.vinta-ai-workflows.yaml`): reviewer Tier 3, fixer Tier 2,
worktree_prep Tier 1, integrate Tier 1. Phase 1 overrides reviewer to Tier 4 per the plan.

**Worktree note**: `deps_strategy: symlink` from config did not hold — pnpm cannot install into a
symlinked `node_modules`, and the provisioning agent's copied store left broken store symlinks
(`tsc` unresolvable). Repaired with a clean `CI=true pnpm install --frozen-lockfile` in the
worktree; `pnpm run typecheck` verified green before Phase 0 started. If a later phase hits a
missing-module error, that is the first thing to re-check.

**API contract baseline**: `schema.yml` synced from `vinta-schedule-api@main` at `272c5e33`.

## Completed phases

### Phase 0 — Client regeneration and public-booking plumbing ✅

- **Status**: review clean — no BLOCKERs; 3 SHOULD-FIX raised and all fixed.
- **Models**: implementer Tier 2; reviewer Tier 3 (`claude-sonnet-5`); fixer Tier 2 (`claude-sonnet-5`).
- **Branch**: `plan/public-scheduling-links/phase-0`, base `plan-public-scheduling-links`.
- **Commit**: `681d431`.
- **E2E**: none — the plan declares no e2e.

`schema.yml` synced from `vinta-schedule-api@main` at `272c5e33` and `src/client/` regenerated via
`pnpm run openapi-ts`. All ten operations the plan names are importable from `@/client/sdk.gen`:
`bookingCodesCreate`, `bookingCodesDestroy`, and the eight `publicBooking*` operations.

Three shared modules landed under `src/lib/booking-links/`, with 27 tests across 3 files:

- `public-client.ts` — hey-api client with **no** interceptors, so `/public/booking/*` calls carry
  neither `Authorization` nor `X-Organization-Id`.
- `errors.ts` — `parseReadFailure(response)` takes only a `Response`, which makes body-branching
  structurally impossible; every 403 collapses to `'link-invalid'`. `parseWriteFailure` marks only
  `SLOT_UNAVAILABLE` retryable.
- `build-url.ts` — a discriminated `scope: { kind: 'calendar'; durationSeconds? } | { kind: 'group' }`
  makes a group link carrying a client-chosen duration **unrepresentable**. This was a review
  finding, fixed before any Phase 1 call site exists. `code` and `slug` are wrapped in
  `encodeURIComponent`.

The regeneration also pulled in the unrelated Calendar Pools additions. About 28 test and story
fixture files gained the newly required `pools: []`, `public_booking_slug` and `group_selections: []`
fields. The reviewer confirmed **no pre-existing assertion was weakened, deleted, or rewritten** —
that is the compensating control for shipping without a feature flag.

One plan-text correction landed in the same commit: the Phase 0 acceptance line said "nine
`publicBooking*` operations", but the plan's own section 3.1 names eight, and eight is what the
generated SDK contains.

**Gate**: `pnpm run typecheck` exit 0, zero errors; `pnpm run lint` exit 0 with 50 pre-existing
warnings; `pnpm run test` green — 233 files / 1925 tests, plus design-system 11 files / 82 tests.

**Known pre-existing**: `pnpm run format` reports 4 warnings, all in unrelated
`ai-plans/2026-08-*` markdown files. They are unmodified on this branch and already unformatted on
`main`, so they were left alone to keep them out of this diff.

## Current phase

**Phase 1 — Mint and revoke a scheduling link** — next.

## Remaining phases

| Phase | Title                                    | Implementer tier         |
| ----- | ---------------------------------------- | ------------------------ |
| 1     | Mint and revoke a scheduling link        | 3 (reviewer override: 4) |
| 2     | Public booking page, single calendar     | 3                        |
| 3     | Public booking page, calendar group      | 3                        |
| 4     | Admin-minted reschedule and cancel links | 3                        |
| 6     | Group public-scheduling settings         | 2                        |

## Deferred phases

| Phase | Title                                       | Why deferred                                                                                                                                                                |
| ----- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5     | Attendee self-service links on confirmation | Blocked on `vinta-schedule-api` Phase 8 (patient self-service management codes) — in progress upstream. No `management` object on any response as of API `main` `272c5e33`. |
| 7     | Reusable codeless group booking page        | Blocked on `vinta-schedule-api` Phase 9's four codeless slug-addressed reads — in progress upstream. Confirmed absent from API `main` `272c5e33`.                           |

No flag-removal phase — this plan declares no feature flag.
