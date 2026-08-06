# Tracking — Calendar Group-Scoped Availability (Web)

- **Plan**: [2026-08-05-CALENDAR_GROUP_SCOPED_AVAILABILITY_IMPLEMENTATION_PLAN.md](2026-08-05-CALENDAR_GROUP_SCOPED_AVAILABILITY_IMPLEMENTATION_PLAN.md)
- **Spec**: [2026-08-05-CALENDAR_GROUP_SCOPED_AVAILABILITY_SPEC.md](2026-08-05-CALENDAR_GROUP_SCOPED_AVAILABILITY_SPEC.md)
- **Backend contract**: [2026-08-05-CALENDAR_GROUP_SCOPED_AVAILABILITY_HANDOFF.md](2026-08-05-CALENDAR_GROUP_SCOPED_AVAILABILITY_HANDOFF.md)
- **Started**: 2026-08-05
- **Last updated**: 2026-08-05
- **Feature flag**: none — the plan justifies skipping one in **Guiding Decisions** (additive surface; the single change touching an existing page ships as its own revertible phase). No flag-removal phase exists.

## Run options

| Option | Value |
|---|---|
| `pause_between_phases` | `false` |
| `generate_inline_comments` | `true` |
| `full_test_suite` | `true` |
| `run_e2e` | `false` — no phase in this plan carries an e2e spec |
| `use_worktree` | `false` |
| `workroot` | `/Users/hugobessa/Workspaces/vinta-schedule-frontend-web` (main checkout) |
| `base_branch` | `main` |
| `sandbox_tier` | `none` |
| `commit_strategy_resolved` | `stacked-branches` |

Branch pattern: `plan/calendar-group-scoped-availability/phase-{id}`, each based on the previous phase.

## Known risks carried into this run

- **Phase 2 rests on two unverified assumptions**, accepted deliberately at Step 0 rather than checked against the backend: that the calendar groups list endpoint returns a non-admin member's groups, and that a non-admin's calendar list returns only calendars they own. Both are **Open Questions** in the plan. Phase 2's tests mock the generated client, so neither assumption is exercised by the test suite — if either is wrong, the member path ships broken and green. The backend branch is checked out at `~/Workspaces/vinta-schedule` if this is revisited.
- **Nothing in this stack is releasable until the backend branch merges and deploys.** The endpoints exist only on `feat/calendar-group-scoped-availability` in the backend repo.

## Completed phases

### Phase 0 — Commit schema refresh and regenerated clients ✅

- **Branch**: `plan/calendar-group-scoped-availability/phase-0` (base: `main`)
- **Implementer model**: Tier 1 (haiku)
- **Reviewer model**: Tier 3 (sonnet) — project default, no phase override
- **Commits**: `3dc4f1d` chore(client): regenerate API client for group-scoped availability; `7f962ef` fix: update KindEnum import to ExternalEventChangeRequestKindEnum for regenerated client

Summary:

The regenerated hey-api output landed on its own — `schema.yml` plus the four generated client files, 16,670 insertions against 8,752 deletions. No generated file was hand-edited.

The regen turned out not to be purely additive, which the plan had flagged as a risk. Two exported enums were renamed by the backend's schema changes:

- `KindEnum` → `ExternalEventChangeRequestKindEnum`. One hand-authored consumer, `src/components/change-requests/change-request-metadata.ts`, stopped typechecking and was updated in a separate commit. Values are unchanged (`'update' | 'delete'`), so the fix is a pure type-name swap.
- `WeekStartEnum` → split into `OrganizationWeekStartEnum` and `RecurrenceRuleWeekStartEnum`. Zero consumers outside the generated client, so no fix was needed. This is the organization-level week-start setting the backend introduced for quota period boundaries.

Review found no BLOCKER and no SHOULD-FIX. The reviewer verified the full exported-symbol surface of all four generated files against `main` (zero removals beyond the two documented renames), and cross-checked every symbol the non-generated tree imports from `@/client` — 112 type imports and 75 hook/query imports — against the new surface. All resolve.

Gates: `pnpm run typecheck` clean (app + design system). `pnpm run test` full suite green — 135 app test files / 1157 tests, 11 design-system files / 82 tests.

### Phase 1 — Group detail route, read-only ✅

- **Branch**: `plan/calendar-group-scoped-availability/phase-1` (base: `plan/calendar-group-scoped-availability/phase-0`)
- **Implementer model**: Tier 3 (sonnet)
- **Reviewer model**: Tier 3 (sonnet) — project default. **Fixer**: Tier 2, run on sonnet (change spanned 8 files)
- **Commits**: `79b248b` feat(calendar-groups): add read-only group detail route (Phase 1); `50dd2d8` fix(calendar-groups): gate group fetch on role, surface truncated config counts

Summary:

The detail route ships read-only: `useCalendarGroup` over `calendarGroupsRetrieve` with a typed `isNotFound`, a detail view with one card per slot, a roster accordion whose rows expand into an empty panel shell (`data-testid="roster-panel-{id}"`) that Phases 3b/4/5/6 mount editors into, and `GroupNotFound`. The groups table's name cell now links to the route.

Non-disclosure is structural, not just copy: `GroupNotFound` takes **no props describing which 404 case occurred**, so it cannot leak the cause by construction. The page test asserts identical output across four fixtures — missing, other-org, unauthorized, out-of-scope — with deliberately differing response bodies, proving the component is insensitive to body content and not merely to status.

Review found one **BLOCKER**, fixed: `useCalendarGroup(id)` was called unconditionally *before* the `if (!isAllowed) return null` gate, and the hook passed no `enabled` option — so a non-admin guessing `/groups/{id}` triggered a real fetch of that group's roster (calendar names, emails) before `useRequireRole`'s redirect effect ran. This is exactly the anti-pattern the sibling groups page documents avoiding, where the fetching hook lives inside a child mounted after the gate. Fixed by adding `{ enabled }` to the hook, following the existing `useCurrentOrganization({ enabled })` idiom. The test that let it through asserted only absent text; it now asserts the retrieve operation was **not called**, and the fixer confirmed that assertion fails against the pre-fix code by stashing the fix and re-running.

One **SHOULD-FIX**, also fixed: the config-summary counts fetched a single 200-row page shared across the whole slot roster, so counts silently became lower bounds past that. The hook now compares each query's `count` against the page size and exposes `isTruncated`; the summary cell renders `200+ configured (exact count unavailable)` rather than a precise-looking number it cannot back up.

Deviation from the Touch List, accepted: `src/hooks/calendar-groups/use-group-scoped-config-summary.ts` was added because AGENTS.md forbids components calling the generated client directly and the roster's summary cell needs the three list queries. It is list-only, no CRUD, and documented as scaffolding Phase 3a supersedes.

Gates: typecheck clean. Full suite green — 141 app files / 1178 tests, 11 design-system files / 82 tests. Lint 0 errors (46 pre-existing warnings, none in touched files).

### Phase 2 — Member access and ownership-based editability ✅

- **Branch**: `plan/calendar-group-scoped-availability/phase-2` (base: `phase-1`)
- **Implementer model**: Tier 3 (sonnet)
- **Reviewer model**: Tier 4 (opus) — plan override, because this phase removes a role gate and defines the predicate every later editor trusts. **Fixer**: Tier 2, run on sonnet (13 files)
- **Commits**: `868d779` feat(calendar-groups): open group access to owning members (Phase 2); `bf6dbcf` fix(calendar-groups): close the Phase 2 permission-boundary gaps

Summary:

The groups list and detail route are now reachable by members, filtered to groups containing a calendar they own; the `groups` nav item moved into the member set. Editability comes from one pure predicate, `canEditCalendar({ role, ownedCalendarIds, calendarId })`, consumed through a context so later editor phases never re-derive it. Non-owned rows render with **no write affordance** rather than a disabled one.

**Open Question 2 is effectively resolved.** The implementer found that the calendar list endpoint accepts `owner: 'me'`, documented in the generated schema as *"return only the authenticated user's own calendars"* — an unconditional scope, rather than the role-dependent default the plan assumed when it said to omit the param. Ownership no longer rests on inferring behavior from the caller's role. Open Question 1 (does the group list serve members at all) remains unverified.

Review found **two BLOCKERs**, both fixed:

1. **The permission branch failed open.** `isMember = role === 'member'` meant `role === null` took the *admin* path — unfiltered groups, org-wide count, the create button, a mounted create dialog. And `role === null` is reachable on every full page load, because `RoleProvider` is not mounted until the auth check resolves. So the first client commit of `/groups` rendered admin chrome and fired an unscoped group list. Phase 1 rendered nothing there, so this was a regression against an existing shipped page; the sibling detail route failed closed on the identical condition, so the two surfaces disagreed. Fixed by inverting to `isAdmin`, scoping everything that is not `admin`, and holding the table in its loading state until the role resolves.
2. **Members were pinned to page 1.** The ownership filter ran *after* server-side pagination and then overwrote `totalCount` with the current page's filtered count, so a member whose group sat on page 2+ saw "No calendar groups found" with no pagination control to reach it — breaking the phase's own acceptance criterion. Fixed by fetching a single large page for non-admins and paginating the filtered rows client-side. The admin path is untouched.

Six SHOULD-FIX items also fixed: the pure predicate split out of the provider so a Server Component can import it; a memoized owned-id `Set` (its unstable identity was defeating the provider's own memo); an exported query key; the ownership-fetch error surfaced with a retry on both surfaces instead of silently collapsing into "you own nothing" — which had been rendering a member's own row read-only with the false explanation that only the owner can configure it; Storybook stories fixed, since the fail-closed default had silently turned every existing story read-only; and tests added for the ownership-loading and ownership-error branches plus the nav change.

Both BLOCKER fixes were verified to fail against the pre-fix code by stashing the fix and re-running.

**Known residual**: for a non-admin the group list fetches one large page (200), so an organization with more than 200 groups would truncate a member's list. Named in a code comment, not surfaced in the UI. Judged remote enough to accept — unlike the Phase 1 truncation it mirrors, which was reachable at 200 config rows across a single roster.

Gates: typecheck clean. Full suite green — 1200 app tests, 82 design-system. Lint 0 errors.

### Phase 3a — Group-scoped window data hooks ✅

- **Branch**: `plan/calendar-group-scoped-availability/phase-3a` (base: `phase-2`)
- **Implementer model**: Tier 2, run on sonnet (5 files). **Reviewer**: Tier 3 (sonnet). **Fixer**: Tier 2 (haiku)
- **Commits**: `a1c9612` feat(calendar-groups): add group-scoped window data hooks; `28e6da2` fix(hooks): add truncation signal and document totalCount in useGroupScopedWindows

Summary:

`useGroupScopedWindows` covers list, create, update, and delete for one slot. Create and update return `{ window, orphanedBookings }` unwrapped from the generated write-result, so no caller reaches into the generated shape. Delete returns a typed `{ status: 'deleted' | 'row_gone' }`, distinguishing "another actor deleted it" from a transport failure — it bypasses the generated mutation factory to get status access, which the reviewer confirmed loses nothing (the factory is a trivial `throwOnError: true` wrapper over the same client singleton). Writes invalidate by predicate on the operation id, matching the caveat documented in `use-all-calendars.ts`. `src/lib/utils/api-errors.ts` adds a typed over-limit reader and a not-found predicate.

The tri-state `rrule_string` is handled deliberately: omit the key to leave recurrence unchanged, `null` to clear it, a string to replace it. A plain optional field would have made "clear it" unreachable, since the client's serializer drops `undefined`.

**The list endpoint has no `calendar_id` filter** — verified against the schema — so the hook fetches one 200-row page for the whole slot and filters client-side. Review flagged that it shipped with no truncation signal, which matters because Phase 3b's grid and unrepresentable-rows list are built directly on this hook: past 200 rows they would silently under-represent, against Objective 3's "zero rows unaccounted for". Fixed by exposing `isTruncated`, following the precedent set in Phase 1's config-summary hook. `totalCount` is now documented as the whole slot's count, unaffected by the calendar filter — the two numbers legitimately disagree on a filtered call.

The reviewer **verified rather than assumed** that a diff-based save cannot delete or overwrite a row that was never loaded: an unloaded row is never in the diff. So truncation is an invisibility problem, not a data-loss one.

Gates: typecheck clean. Full suite green — 1228 app tests, 82 design-system.

### Phase 3b — Weekday window grid and unrepresentable rows ✅

- **Branch**: `plan/calendar-group-scoped-availability/phase-3b` (base: `phase-3a`)
- **Implementer model**: Tier 3 (sonnet). **Reviewer**: Tier 4 (opus) — plan override, this being the plan's highest data-loss risk. **Fixer**: Tier 2, run on sonnet
- **Commits**: `ba60a59` feat(calendar-groups): add weekday window grid and unrepresentable-row list; `5716b67` fix(calendar-groups): stop phase-3b window grid from mangling multi-day and partially-saved windows

Summary:

The weekday grid, the read-only list of rows the grid cannot express, and a diff-based save that issues only creates/updates/deletes and nothing at all for an untouched grid. Classification is deliberately stricter than the plan asked: representable only when the rule's key set is *exactly* `{FREQ, BYDAY}` with `FREQ=WEEKLY` and one `BYDAY`, and `parseRRule` is deliberately not reused because it silently drops unrecognized parts.

The Tier 4 review earned its cost. It ran the classifier against 45 adversarial inputs rather than reading the source, and found **two data-corrupting BLOCKERs**:

1. **A multi-day window was classified representable.** The guard compared `end.weekday !== start.weekday`, and weekday numbers repeat every 7 days — so a Monday-to-Monday window spanning a full week passed it and rendered as an ordinary 8-hour Monday row. Unticking Monday would `DELETE` a week-long window whose extent the admin never saw; editing its time would `PATCH` it down from 7 days to 8 hours. Exactly the "wrongly representable → rewritten or deleted" direction the module claims to bias against. Fixed by comparing calendar days (`hasSame(end, 'day')`).
2. **A partially-failed save duplicated everything that had already succeeded.** `Promise.all` rejects on the first failure, so the diff baseline never updated — but a create that *had* succeeded already wrote its server id into the form. On retry the diff saw an id absent from the baseline and pushed it to `creates`, producing a duplicate window. Not hypothetical: this phase's own documented interim behavior sends an over-limit 402 to a generic error toast, and over-limit is precisely the case where write N fails after 1..N-1 succeeded. Fixed with `Promise.allSettled`, rebuilding the baseline from the fulfilled outcomes even on failure.

Seven SHOULD-FIX items also fixed. The notable ones: the double-submit guard was a stale-closure state read that did nothing, **and its test was vacuous** — `await user.click` flushes React between clicks, so the second landed on an already-disabled button and never reached the handler; the test passed unchanged with the guard deleted. Now a synchronous ref guard, tested with two un-awaited `fireEvent.submit` calls in one `act`. The timezone field was free text with only a `min(1)` check, so a typo produced an invalid `DateTime` and the app POSTed `start_time: null` behind a generic failure toast; it is now a validated `Select` with the non-null assertions replaced by an explicit throw. Rows in a timezone differing from the grid's are now classified unrepresentable, since two rows could otherwise both read `09:00` and mean different instants. One-shot hydration was defeating the refetch the plan's "writes refetch" decision requires.

All three critical fixes were verified to fail against the pre-fix code before being accepted.

The fixer also hit a real Radix `Select` behavior worth recording: a controlled value changed *after* mount while the dropdown has never been opened is silently reset to `''`, because the native `<option>` mirror stays empty until first open. It blanked the timezone and failed every write until worked around with a keyed remount. **Any RHF + Select form in this repo that hydrates asynchronously is exposed to this** — worth a follow-up audit.

Gates: typecheck clean. Full suite green — 1271 app tests, 82 design-system.

## Current phase

Phase 3c — Surface orphaned bookings and plan limits.

## Remaining phases
- Phase 3c — Surface orphaned bookings and plan limits (Tier 2)
- Phase 4 — Group-scoped blocked times (Tier 2→3)
- Phase 5 — Group-scoped quota rules (Tier 2)
- Phase 6 — Effective availability preview (Tier 3)

## Deferred phases

None. The plan declares no feature flag, so there is no flag-removal phase, and it contains no cross-repo phase — the backend dependency is a release-ordering note in **Risk & Rollout Notes**, not a phase.
