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

## Current phase

Phase 1 — Group detail route, read-only.

## Remaining phases

- Phase 1 — Group detail route, read-only (Tier 3)
- Phase 2 — Member access and ownership-based editability (Tier 3; reviewer Tier 4)
- Phase 3a — Group-scoped window data hooks (Tier 2)
- Phase 3b — Weekday window grid and unrepresentable rows (Tier 3; reviewer Tier 4)
- Phase 3c — Surface orphaned bookings and plan limits (Tier 2)
- Phase 4 — Group-scoped blocked times (Tier 2→3)
- Phase 5 — Group-scoped quota rules (Tier 2)
- Phase 6 — Effective availability preview (Tier 3)

## Deferred phases

None. The plan declares no feature flag, so there is no flag-removal phase, and it contains no cross-repo phase — the backend dependency is a release-ordering note in **Risk & Rollout Notes**, not a phase.
