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

## Current phase

Phase 2 — Member access and ownership-based editability.

## Remaining phases

- Phase 2 — Member access and ownership-based editability (Tier 3; reviewer Tier 4)
- Phase 3a — Group-scoped window data hooks (Tier 2)
- Phase 3b — Weekday window grid and unrepresentable rows (Tier 3; reviewer Tier 4)
- Phase 3c — Surface orphaned bookings and plan limits (Tier 2)
- Phase 4 — Group-scoped blocked times (Tier 2→3)
- Phase 5 — Group-scoped quota rules (Tier 2)
- Phase 6 — Effective availability preview (Tier 3)

## Deferred phases

None. The plan declares no feature flag, so there is no flag-removal phase, and it contains no cross-repo phase — the backend dependency is a release-ordering note in **Risk & Rollout Notes**, not a phase.
