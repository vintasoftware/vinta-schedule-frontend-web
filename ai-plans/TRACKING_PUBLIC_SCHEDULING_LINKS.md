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
- **Branch**: `plan/public-scheduling-links/phase-0`, base `main`.
- **PR**: [#127](https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/127) — published.
- **PR context**: `.vinta-ai-workflows/prs-context/public-scheduling-links/phase-0.md` (`status: published`).
- **Commit**: `681d431`.
- **E2E**: none — the plan declares no e2e.

**Base-branch note**: `plan-public-scheduling-links` was created but never got a commit of its
own, so it is byte-identical to `main` at `8f1d151`. Phase 0's PR therefore targets `main`
directly, which matches the prs-context template's rule that the first stacked phase targets the
default branch. Phase 1 stacks on `plan/public-scheduling-links/phase-0` as normal.

**Symlink repair**: the worktree's `.vinta-ai-workflows` symlink pointed at `../../.vinta-ai-workflows`,
which resolves to `.claude/.vinta-ai-workflows` and does not exist. Repointed to
`../../../.vinta-ai-workflows` (the main checkout's copy, which holds this plan's worktree
summary). Local gitignored state only. Note the symlink itself still shows as untracked because
`.gitignore` has `.vinta-ai-workflows/` with a trailing slash, which does not match a symlink —
do not stage it.

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

### Phase 1 — Mint and revoke a scheduling link ✅

- **Status**: review clean — 3 BLOCKERs and 6 SHOULD-FIX raised, all fixed.
- **Models**: implementer Tier 3 (`claude-sonnet-5`); reviewer **Tier 4** (`claude-opus-5`, plan
  override); fixer Tier 2 stepped up to `claude-sonnet-5` (>3 files).
- **Branch**: `plan/public-scheduling-links/phase-1`, base `plan/public-scheduling-links/phase-0`.
- **PR**: [#128](https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/128) — published, stacked on #127.
- **PR context**: `.vinta-ai-workflows/prs-context/public-scheduling-links/phase-1.md` (`status: published`).
- **Commits**: `aa36f66` (implementation), `40cf0da` (review fixes).
- **E2E**: none.

Both booking-code hooks, the `canMintBookingLink*` predicate, `MintedBookingLink`, the
mint/reveal/revoke dialog, row actions on both tables, and a header action on the group detail
view. 20 files, ~2095 insertions.

**The Tier 4 escalation earned its keep.** The plan escalated this phase's reviewer because the
code is a live credential delivered exactly once. It found a real leak that the implementer's own
doc comment claimed was handled:

- **BLOCKER — the plaintext code survived in the TanStack mutation cache for ~5 minutes after the
  dialog closed.** `MutationObserver.reset()` only calls `removeObserver()` → `scheduleGc()`; the
  mutation holding `state.data.code` is dropped after `gcTime`, not synchronously, and the app
  sets no mutation `gcTime`. Fixed with `gcTime: 0`.
- **BLOCKER — the close-reset effect was dead code at two of three call sites.** Both tables mount
  the dialog conditionally, so it unmounts before ever re-rendering with `open={false}`. Added an
  unmount cleanup.
- **BLOCKER — the phase's required permission tests were entirely missing.** `canMintLink` /
  `onMintLink` / "Get scheduling link" appeared in no test file. Closed across both table test
  files plus `group-detail-view.test.tsx`.

**Verified by falsification**: removing `gcTime: 0` makes both containment tests fail, so they are
real regression tests rather than vacuous ones. Confirmed by the orchestrator, not taken on the
fixer's report.

Notable SHOULD-FIX: `retry: 0` on the create mutation. The app retries mutations once by default,
so a network failure after the server committed would create a **second live code** that the UI
never reveals and that — with no list or retrieve endpoint — could never be revoked.

**Pre-existing assertions confirmed untouched** in both table test files. The only removed lines
are the `renderCalendarsTable` signature (now with an optional `permissions` defaulting to `null`,
so existing call sites behave identically) and an extended import. No `it(...)` body changed.

**Accepted deviation**: the dialog stories cover the pre-mint form only, not the reveal or revoked
states. Precedent is `new-token-dialog.stories.tsx`, the sibling one-time-credential dialog, and a
reveal story would mean checking a plausible-looking `code` fixture into the repo. Reveal and
revoked are covered in the colocated test. The Tier 4 reviewer read the precedent and agreed.

**Known coverage shape**: the groups-table denied case cannot be produced through the rendered
table — the pre-existing `groupHasOwnedCalendar` filter removes exactly the rows a member would be
denied, and `permissions === null` holds the table in its loading branch. It is unit-tested
against `createColumns`' actions cell instead, with a comment in the test recording why, so the
gap is not re-filed later.

**Gate**: `pnpm run typecheck` exit 0, zero errors; `pnpm run lint` exit 0, 51 pre-existing
warnings; `pnpm run test` 237 files / 1963 tests plus design-system 11 / 82, all pass.

### Phase 2 — Public booking page, single calendar ✅

- **Status**: review clean — 1 BLOCKER and 3 SHOULD-FIX raised, all fixed.
- **Models**: implementer Tier 3 (`claude-sonnet-5`); reviewer Tier 3 (`claude-sonnet-5`); fixer Tier 2 stepped up to `claude-sonnet-5`.
- **Branch**: `plan/public-scheduling-links/phase-2`, base `plan/public-scheduling-links/phase-1`.
- **PR**: [#129](https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/129) — published, stacked on #128.
- **PR context**: `.vinta-ai-workflows/prs-context/public-scheduling-links/phase-2.md` (`status: published`).
- **Commits**: `efd890c` (implementation), `f2f7135` (review fixes).
- **E2E**: none.

Both public routes, the two hooks, and six components under `src/components/public-booking/`.
29 files, ~2739 insertions.

**BLOCKER — the public routes were indexable.** The plan's **Open Questions** row settles this
unconditionally: a booking link in a search index is a leaked credential, so `noindex` goes on
every `/book/*` and `/g/*` route, added in Phase 2 and carried into every later public route.
Neither page exported `metadata` and there was no `src/app/robots.ts`. Closed with a shared
`NO_INDEX_METADATA` constant (`src/lib/booking-links/no-index-metadata.ts`), used by both routes,
plus a crawler-level `src/app/robots.ts`, plus per-route tests. **Phases 3, 4 and 7 must import
that constant for every new public route.**

**Cross-phase SHOULD-FIX — the mint dialog's default produced a permanently broken link.** This
lived in `mint-booking-link-dialog.tsx`, a Phase 1 file, but was only reachable once Phase 2
shipped the page that opens the link, so it was fixed here rather than by rewriting Phase 1's
branch. The duration field defaulted to zero and the dialog applied the booking-policy
"0 = unconstrained" convention, emitting no `?duration=`. That convention does not apply: the
generated client documents `duration_seconds` as "ALWAYS REQUIRED to be present (a request
omitting it is a 400…)" — there is no unconstrained mode on this read. So minting a calendar link
without touching the duration control — **the default path** — produced a link that showed
"missing a valid duration" to every recipient, forever. Fixed by defaulting calendar targets to 30
minutes and adding a zod refinement requiring a duration above zero. Group targets untouched.

One pre-existing test was replaced, legitimately: it asserted that a zero duration mints a link
with no `?duration=`, which is exactly the broken behavior. It now asserts the case is blocked with
a visible message and issues no mutation. Verified the diff removed only that test's title and its
one invalid assertion.

Other fixes: a colocated story plus tests for `public-booking-flow.tsx`'s two previously uncovered
inline branches (`invalid-duration`, `slots-load-error`), and network-failure / non-JSON-body tests
for both hooks — asserting in particular that a network failure is **not** reported as
`'link-invalid'`, which would tell an attendee their link is dead when it is not.

**Reviewer ruled three implementer judgment calls acceptable, no change needed**: the hardcoded
`title: 'Appointment'` (the public endpoints never expose a calendar name to an unauthenticated
caller, so there is nothing non-guessed to derive one from), the 14-day search window, and the
separate "missing duration" card being distinct from `LinkInvalid` (the code-gated read is never
called in that state, so there is no oracle risk).

**Gate**: `pnpm run typecheck` exit 0, zero errors; `pnpm run lint` exit 0, 52 pre-existing
warnings; `pnpm run test` 244 files / 1994 tests plus design-system 11 / 82, all pass.

## Current phase

**Phase 3 — Public booking page, calendar group** — next.

## Remaining phases

| Phase | Title                                    | Implementer tier |
| ----- | ---------------------------------------- | ---------------- |
| 3     | Public booking page, calendar group      | 3                |
| 4     | Admin-minted reschedule and cancel links | 3                |
| 6     | Group public-scheduling settings         | 2                |

## Deferred phases

| Phase | Title                                       | Why deferred                                                                                                                                                                |
| ----- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5     | Attendee self-service links on confirmation | Blocked on `vinta-schedule-api` Phase 8 (patient self-service management codes) — in progress upstream. No `management` object on any response as of API `main` `272c5e33`. |
| 7     | Reusable codeless group booking page        | Blocked on `vinta-schedule-api` Phase 9's four codeless slug-addressed reads — in progress upstream. Confirmed absent from API `main` `272c5e33`.                           |

No flag-removal phase — this plan declares no feature flag.
