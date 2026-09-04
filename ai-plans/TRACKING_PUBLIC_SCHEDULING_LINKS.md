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

### Phase 3 — Public booking page, calendar group ✅

- **Status**: review clean — no BLOCKERs; 2 SHOULD-FIX and 1 NIT, all fixed.
- **Models**: implementer Tier 3 (`claude-sonnet-5`); reviewer Tier 3 (`claude-sonnet-5`); fixer Tier 2 stepped up to `claude-sonnet-5`.
- **Branch**: `plan/public-scheduling-links/phase-3`, base `plan/public-scheduling-links/phase-2`.
- **PR**: [#130](https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/130) — published, stacked on #129.
- **PR context**: `.vinta-ai-workflows/prs-context/public-scheduling-links/phase-3.md` (`status: published`).
- **Commits**: `34d36a7` (implementation), `831f216` (review fixes).
- **E2E**: none.

The group hook (three operations), `group-slot-selection.tsx`, `public-group-booking-flow.tsx`,
and `public-booking-entry.tsx`. 27 files, ~2874 insertions.

**Target resolution is URL-encoded, never probed.** `build-url.ts` writes
`?target=calendar|group` on every `book` link; `resolveBookingLinkTarget` is pure and
zero-network. The rejected alternative — try the calendar read, fall back to group on 403 — would
have turned the deliberately-uniform 403 into the state oracle it exists to prevent. Only the
literal `target=group` means group; anything else resolves to calendar, so a pre-change calendar
link still works. Flipping the marker by hand yields a clean 403-driven invalid-link state.

**SHOULD-FIX — a group with no pinned duration silently booked a frontend-chosen 30 minutes.**
The group bookable-slots read requires `duration_seconds` (verified: it is a required `number`, so
the plan's "sends no duration of its own" is literally impossible), so the flow sends a 1800s
placeholder that a pinned duration silently overrides. When the group pins **no** duration, that
placeholder became the real booked length. Code-gated booking does not require
`accepts_public_scheduling`, so such a link was mintable. The implementer called this
"out-of-scope"; the reviewer overruled that, correctly. Closed at the source: the mint dialog now
refuses to create a `book` link for a group whose duration is unset, and
`MintBookingLinkTarget`'s group variant carries the duration so it can check.

⚠️ **Note for Phase 6**: `mint-booking-link-dialog.tsx`'s `groupDurationIsUnset` is a deliberately
minimal "unset or zero" predicate, not a real parser. Its comment points at
`@src/lib/booking-links/duration-format.ts` as Phase 6's file. **Phase 6 must either create that
path or update the comment**, and should consolidate the predicate into the real two-way helper.

**SHOULD-FIX — the group hook's tests could not catch a swap to the authenticated client.** All
three assertions omitted `client: publicBookingClient`. Fixed, plus a dedicated
`use-public-group-booking.public-client.test.ts` that drives a real request through the public
client. It needs its own file because the main hook test mocks `@/client/sdk.gen` at module scope,
so nothing there reaches a real `fetch`.

**Helpers moved on evidence, as the plan required.** The plan said to extract the selection helpers
only if importing them from the authenticated hook drags authenticated-client code into the public
bundle. A probe build showed `useCalendarEvents`, `toCalendarEventVMs` and
`invalidateCalendarEvents` reaching the `/book/[code]` chunks; after moving to
`src/lib/booking-links/group-selection.ts`, a rebuild confirmed they are gone.
`use-group-booking.ts` re-exports everything and `src/components/calendar-groups/` tests pass
untouched.

**Accepted without change**: the `'via-code'` path-segment placeholder (the server resolves the
group from the token on the coded branch and answers 403, never 404), and returning to whole-group
time selection on `SLOT_UNAVAILABLE`.

**Gate**: `pnpm run typecheck` exit 0, zero errors; `pnpm run lint` exit 0, 52 pre-existing
warnings; `pnpm run test` 250 files / 2035 tests plus design-system 11 / 82, all pass.

### Phase 4 — Admin-minted reschedule and cancel links ✅

- **Status**: review clean — no BLOCKERs; 1 SHOULD-FIX and 2 NITs, all resolved, plus one
  follow-up fix the orchestrator found while acting on the SHOULD-FIX.
- **Models**: implementer Tier 3 (`claude-sonnet-5`); reviewer Tier 3 (`claude-sonnet-5`); fixer Tier 2 stepped up to `claude-sonnet-5`.
- **Branch**: `plan/public-scheduling-links/phase-4`, base `plan/public-scheduling-links/phase-3`.
- **PR**: [#131](https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/131) — published, stacked on #130.
- **PR context**: `.vinta-ai-workflows/prs-context/public-scheduling-links/phase-4.md` (`status: published`).
- **Commits**: `fb1ab93` (implementation), `1026c44` (review fixes), `55b3605` (visibility fix).
- **E2E**: none.

Four new routes, two hooks, and an event-scoped mint target reached from the events sheet.
29 files, ~3492 insertions.

**Scope is encoded at mint time for `reschedule` too** — `build-url.ts` now writes `?target=` for
`book` and `reschedule`. `cancel` gets none because only one cancel endpoint exists for both
scopes (verified against the generated client). No endpoint is ever tried and recovered from.

**SHOULD-FIX — the ungated events-sheet buttons rested on a false premise.** The implementer
justified leaving "Get reschedule link" / "Get cancel link" ungated by claiming the events list is
already scoped to what the viewer can act on. The reviewer disproved it: `CalendarEventVM.calendarId`
is only populated in the single-calendar filtered view, so in the default aggregate view the list
can include events the viewer does not own. The reviewer also drew the right distinction — the
sheet's Edit/Cancel act as the signed-in member and are bounded by their session, whereas a minted
code is a standalone credential.

**User decision**: keep the buttons ungated and fix the false comment. Every available gate would
hide the button from a plain member who legitimately owns the appointment's calendar — the common
case — because no per-event calendar-owner id is reachable. Closing it properly needs
`CalendarEvent` / `CalendarEventVM` to carry one.

⚠️ **Follow-up the orchestrator found while applying that decision.** The ungated choice rests on
"the server's 403 is surfaced inline". It was not. `applyServerFieldErrors` routes field errors and
`non_field_errors` to the form but **not** a bare `{"detail": ...}` — its own header comment says a
`detail` belongs in a toast — and no `<Toaster />` is mounted anywhere, so that toast renders
nothing. `schema.yml` documents only a `201` for `POST /booking-codes/`, so the shape is not pinned,
and DRF's default `PermissionDenied` body is exactly `{"detail": ...}`. **An unauthorized member
clicked the button and nothing happened at all.** Fixed by forcing every mint failure shape onto the
form root, and by giving a failed revoke its own inline alert saying the link is still active —
previously toast-only, so a member could believe they had killed a live link.

**Verified by falsification**: removing the inline-error line makes the new `{detail}` test fail.

**Reviewer verified and accepted**: times-only reschedule (no editable title/description/attendee),
`ALREADY_USED` wording distinct from the opaque invalid-link state, both hooks' real-request
public-client tests, credential containment surviving the event-scoped target, cancel-as-204, the
`group_selections.length > 0` scope inference, the reschedule duration from the event's own span,
the structurally-unavoidable unset-group-duration gap for event-scoped reschedule, and the
`play`-function stories.

**Note on a flakiness report**: the fixer reported scattered full-suite failures in untouched files.
The orchestrator re-ran the full suite on this branch and it was clean (260 files / 2085 tests, exit
0). Sandbox contention in the subagent's environment, not a regression.

**Gate**: `pnpm run typecheck` exit 0, zero errors; `pnpm run lint` exit 0, 55 warnings (3 above the
52 baseline are unused `_req` params in the new `.public-client.test.ts` files); `pnpm run test`
260 files / 2089 tests plus design-system 11 / 82, all pass.

## Current phase

**Phase 6 — Group public-scheduling settings** — next. Last plan phase in scope.

## Remaining phases

| Phase | Title                            | Implementer tier |
| ----- | -------------------------------- | ---------------- |
| 6     | Group public-scheduling settings | 2                |

## Deferred phases

| Phase | Title                                       | Why deferred                                                                                                                                                                |
| ----- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5     | Attendee self-service links on confirmation | Blocked on `vinta-schedule-api` Phase 8 (patient self-service management codes) — in progress upstream. No `management` object on any response as of API `main` `272c5e33`. |
| 7     | Reusable codeless group booking page        | Blocked on `vinta-schedule-api` Phase 9's four codeless slug-addressed reads — in progress upstream. Confirmed absent from API `main` `272c5e33`.                           |

No flag-removal phase — this plan declares no feature flag.
