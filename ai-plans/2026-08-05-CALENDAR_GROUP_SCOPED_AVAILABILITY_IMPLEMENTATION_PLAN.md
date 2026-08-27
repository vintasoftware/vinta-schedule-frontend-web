# Calendar Group-Scoped Availability (Web) — Implementation Plan

Spec: [2026-08-05-CALENDAR_GROUP_SCOPED_AVAILABILITY_SPEC.md](2026-08-05-CALENDAR_GROUP_SCOPED_AVAILABILITY_SPEC.md).
Backend API contract: [2026-08-05-CALENDAR_GROUP_SCOPED_AVAILABILITY_HANDOFF.md](2026-08-05-CALENDAR_GROUP_SCOPED_AVAILABILITY_HANDOFF.md).

## 1. Goals

1. Ship a group detail page where an organization admin can list, create, edit, and delete group-scoped **availability windows**, **blocked times**, and **quota rules** for any calendar in any slot of a group in their organization.
2. Let a calendar's owner configure their own participation from the same page, with every calendar they do not own rendered read-only and no write control reachable for it.
3. Represent every row the API returns — editable in the weekday grid, or listed read-only with a delete action when the grid cannot express it. A grid save never rewrites or drops a row it could not represent.
4. Give each documented failure mode its own handled state: the orphaned-bookings list, the plan-limit rejection, the non-disclosure not-found response, and a write against a row another actor deleted.
5. Leave the availability page, the group booking flow, the calendar views, and the colleague availability view behaving exactly as they do today.

**Non-goals:**

- Editing the group, its slots, or its slot rosters (name, `required_count`, calendar pool). The detail page renders all of it read-only.
- Bulk copy of configuration across calendars or across groups.
- Any change to the base availability surfaces — the availability tabs, weekday editor, base blocked-time form, colleague view.
- Rendering group-scoped windows or blocks in the calendar view, events view, or colleague availability view.
- Parsing `outside_window` / `inside_block` / `quota_consumed` out of booking-rejection messages. Group booking keeps its existing race-condition path untouched.
- A plan-usage counter ("X of Y availability windows used") anywhere in the app.
- A quota consumption indicator ("2 of 3 used this week") — no endpoint provides the count.
- The public API batch-upsert operations (`batchUpsertGroupScoped*`). They need a partner bearer token; the web app uses the session-authenticated REST resources.
- Playwright e2e specs. Unit + Testing Library integration only; e2e can be added per-flow later via [add-e2e-test](../.claude/skills/add-e2e-test/SKILL.md).

## 2. Guiding Decisions

| Decision                                                   | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No feature flag**                                        | The surface is additive: a brand-new route, new hooks, new components, and REST resources nothing existing reads or writes. The one change that touches an existing page — opening the calendar groups list to members — is a self-contained phase reverted by one `git revert`, and the repo has no feature-flag module to hang a flag on. Building flag infrastructure for a single, cheaply-revertible visibility change costs more than it protects. |
| **Route pattern follows the existing groups page**         | The detail route is a client component with the gate in the component and TanStack Query for all reads, matching [page.tsx](<../src/app/(app)/groups/page.tsx>). Diverging into a server component here would fork the pattern across two sibling pages and complicate the identical-not-found requirement.                                                                                                                                              |
| **Phase granularity: bundled by concept**                  | One phase per concept (windows, blocks, quota) rather than one per spec use-case, because the use-cases inside a concept share one editor and one hook module — splitting them produces phases that cannot be reviewed without each other. Windows is the largest concern and splits into `3a`/`3b`/`3c`.                                                                                                                                                |
| **Member access lands right after foundation**             | Phase 2, not last. Every editor phase after it is then built and tested against both roles as it lands, so the read-only path is never bolted onto three finished editors.                                                                                                                                                                                                                                                                               |
| **Windows use the weekday grid; blocks use a row list**    | Roster patterns are weekly, and the weekday-grid metaphor already exists in [availability-editor.tsx](../src/components/availability/availability-editor.tsx). Blocks are ad-hoc by nature (a conference, one week off) and reuse the row-list + recurrence-form metaphor from [blocked-time-form.tsx](../src/components/availability/blocked-time-form.tsx). The editors differ because the concepts differ.                                            |
| **Rows the grid cannot express are listed, never hidden**  | A one-off or non-weekly RRULE written through the public API stays visible in a read-only list with a delete action. Hiding them would let a grid save destroy configuration the admin never saw. This is the single highest-risk behavior in the plan and drives the Tier 4 reviewer on Phase 3b.                                                                                                                                                       |
| **Grid saves are diff-based**                              | The grid computes creates / updates / deletes against the rows it loaded and issues only those single-row REST writes. Saving twice with no edits issues nothing — idempotency is the interface's job here, because the web app does not use the public API's batch upsert.                                                                                                                                                                              |
| **Writes refetch; no optimistic updates**                  | Every successful write invalidates the slot's list query. Last-write-wins is the API's model, and optimistic updates over a resource another admin may be editing would show state that never existed on the server.                                                                                                                                                                                                                                     |
| **Ownership resolved from the caller's own calendar list** | "Do I own this calendar" is answered by listing the caller's own calendars and comparing ids, since `Calendar` carries no owner field. See **Open Questions** — this depends on a non-admin's calendar list returning only their own.                                                                                                                                                                                                                    |
| **New design-system atoms allowed where warranted**        | If the weekday grid or a roster row earns a reusable primitive it goes in the workspace package with a colocated story. Default remains composing from existing layout primitives and ui atoms in `src/components/calendar-groups/`.                                                                                                                                                                                                                     |
| **Backend is on a branch**                                 | The schema and generated client in this repo are ahead of what is deployed. Phases are implementable and testable now (tests mock the generated client); nothing is releasable until the backend merges and deploys.                                                                                                                                                                                                                                     |

## 3. Data Model Changes

No persistence is added — this repo has no database. What changes is the generated API surface and the view-model types the components share.

### 3.1 Generated client (already produced, uncommitted)

`schema.yml` and `src/client/` carry the regenerated hey-api output for the new REST resources. The types the plan consumes:

```ts
// src/client/types.gen.ts — generated, do not hand-edit
GroupScopedAvailabilityWindow; // id, calendar_id, group_slot_id, start_time,
// end_time, timezone, rrule_string | null,
// is_recurring, created, modified
GroupScopedAvailabilityWindowCreate; // calendar, start_time, end_time, timezone, rrule_string?
GroupScopedAvailabilityWriteResult; // { window, orphaned_bookings[] }
GroupScopedBlockedTime; // ...same, plus reason
GroupScopedBlockedTimeCreate; // ...same, plus reason?
GroupScopedBlockWriteResult; // { block, orphaned_bookings[] }
GroupScopedQuotaRule; // id, calendar_id, group_slot_id, period, cap, created, modified
GroupScopedAvailabilityOrphanedBooking / GroupScopedBlockOrphanedBooking;
// id, calendar_id, title, start_time, end_time
```

Operations follow the `calendarGroupsSlots{AvailabilityWindows,BlockedTimes,QuotaRules}{List,Create,Retrieve,PartialUpdate,Destroy}` naming, each with a `*Options` / `*Mutation` / `*QueryKey` helper in @src/client/@tanstack/react-query.gen.ts. The `*Formatted*` variants are the `{format}` suffixed routes and are not used.

### 3.2 View-model types

Shared, hand-written types under @src/components/calendar-groups/group-scoped-types.ts:

- `WeekdayWindow` — the grid's row model (weekday, start `HH:mm`, end `HH:mm`, source row id when it already exists), plus the pure functions that parse a `GroupScopedAvailabilityWindow` into one or classify it as unrepresentable.
- `GridDiff` — `{ creates, updates, deletes }` produced by comparing the edited grid against the loaded rows, consumed by the save handler.
- `OrphanedBooking` — the union of the two generated orphan shapes, which are structurally identical, so one alert component serves windows and blocks.

### 3.3 Error mapping

@src/lib/utils/api-errors.ts gains a narrow reader for the over-limit body (`code`, `resource`, `current_usage`, `limit`, `detail`) and a predicate for the not-found response, so components branch on typed results rather than string matching.

## 4. API Design

No endpoints are authored here — the app consumes the REST resources the backend branch added. Recorded for the implementer:

### 4.1 Group-scoped availability windows

`GET|POST /calendar-groups/{group_id}/slots/{slot_id}/availability-windows/`, `GET|PATCH|DELETE .../{id}/`. `PUT` unsupported. List is paginated (`limit`/`offset`). Create and update return `GroupScopedAvailabilityWriteResult` — the saved window plus `orphaned_bookings`, populated on the first window for a calendar in that slot and on any update that narrows. Delete removes the whole series and returns 204. `rrule_string` on PATCH is tri-state: omit to leave unchanged, `null` to clear, string to replace.

### 4.2 Group-scoped blocked times

Same routes under `blocked-times/`, same shapes plus `reason`. Every create and update runs orphan detection, not only the first.

### 4.3 Group-scoped quota rules

Same routes under `quota-rules/`. `period` is `day | week | month`, `cap` ≥ 1. Create returns the rule directly, not a write result — there is no orphan list. One rule per `(calendar, slot, period)`; a duplicate is rejected as `non_field_errors`.

### 4.4 Shared error contract

404 (`{"detail": "Not found."}`) is returned identically for missing, other-organization, out-of-slot, and unauthorized — the four cases are byte-identical by design. 402 with `code: "limit_exceeded"`, `resource: "availability_windows"`, `current_usage`, `limit` on window writes that exceed the plan ceiling. 400 for `start_time >= end_time` and other field validation.

## 5. Phased Rollout

### Phase 0 — Commit schema refresh and regenerated clients

**Goal**: land the schema and generated-client diff on its own so every later phase builds on committed types and no feature review contains 16k lines of codegen. No user-visible change.

**Feature flag**: none — see **Guiding Decisions**.

Changes:

1. Commit `schema.yml` and the regenerated @src/client/types.gen.ts, @src/client/sdk.gen.ts, @src/client/@tanstack/react-query.gen.ts, @src/client/index.ts as produced by the codegen. No hand edits.
2. Confirm the diff is codegen-only: no unrelated formatting churn swept in, per the repo's staging policy.

Spec use-case: shared scaffolding — no use-case yet.

Tests:

- **Unit**: none new. The existing suite must pass unchanged — the generated client is mocked at the module boundary throughout, so a wider surface changes nothing.

**Suggested AI model**: Tier 1 (IDs in [resources/ai-models.yaml](../.claude/skills/plan-feature/resources/ai-models.yaml)). Mechanical commit of generated output.

Acceptance: `pnpm run typecheck` and `pnpm run test` pass with the regenerated client committed, and `git status` shows no remaining uncommitted codegen.

---

### Phase 1 — Group detail route, read-only

**Goal**: an admin can open a group from the list and see its slots, each slot's roster, and per-calendar summaries of how much group-scoped configuration exists — plus an identical not-found state for every unreachable group.

**Feature flag**: none — brand-new route nothing existing reads.

Changes:

1. @src/app/(app)/groups/[id]/page.tsx — client route, admin-gated with `useRequireRole('admin')` as [page.tsx](<../src/app/(app)/groups/page.tsx#L24>) does. Phase 2 replaces this gate.
2. @src/hooks/calendar-groups/use-calendar-group.ts — wraps `calendarGroupsRetrieveOptions`, exposing the group, a typed `isNotFound` derived from the 404 response, and the query for invalidation.
3. @src/components/calendar-groups/group-detail-view.tsx — page header with group name and description, then one section per slot showing its name, `required_count`, and roster.
4. @src/components/calendar-groups/slot-roster.tsx — the roster table for one slot: calendar name, type, and a configuration summary cell reading counts from the three list queries. Rows expand into an empty panel shell that Phases 3–5 fill.
5. @src/components/calendar-groups/group-not-found.tsx — the not-found state: one wording for all four API cases, a link back to the list, no redirect.
6. [groups-table.tsx](../src/components/calendar-groups/groups-table.tsx) — the name cell becomes a link to the detail route.

Spec use-case: **UC-8** (opening a group you cannot see); foundation for the rest.

Tests:

- **Unit**: @src/hooks/calendar-groups/use-calendar-group.test.ts — 404 maps to `isNotFound`, other errors do not.
- **Integration**: @src/app/(app)/groups/[id]/page.test.tsx — renders slots and rosters from a mocked group; a 404 renders the not-found state with no `router.replace` call; the rendered output is identical across the missing / other-org / unauthorized fixtures.
- **Integration**: @src/components/calendar-groups/groups-table.test.tsx — the name cell links to the detail route; existing assertions unchanged.

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](../.claude/skills/plan-feature/resources/ai-models.yaml)). New route plus four components and a hook, spanning routing, query wiring, and an error-state contract.

**Reusable skills**: `new-page` (the detail route); `new-hook` (`useCalendarGroup`); `new-composition` (the detail view, roster, and not-found components); `add-storybook-story` (roster and not-found states).

Acceptance: an admin opening a group in their organization sees its slots and rosters; opening a group id that does not exist, belongs to another organization, or that they cannot see renders one identical not-found state with the URL unchanged.

---

### Phase 2 — Member access and ownership-based editability

**Goal**: a member reaches the groups containing a calendar they own and opens one; their own calendar's rows are marked editable and every other calendar on the page is marked read-only.

**Feature flag**: none — the visibility change is one phase, reverted by one `git revert`. This is the only phase touching an existing surface, and it ships alone for exactly that reason.

Changes:

1. @src/hooks/calendars/use-my-calendars.ts — the caller's own calendars, exposing an `ownedCalendarIds` set. Built on `calendarListOptions` the way [use-colleague-calendars.ts](../src/hooks/availability/use-colleague-calendars.ts) resolves a colleague's, but with no `owner` param.
2. @src/components/calendar-groups/group-permissions.ts — one pure function, `canEditCalendar({ role, ownedCalendarIds, calendarId })`, and a small context so every editor phase consumes the same answer rather than re-deriving it.
3. [page.tsx](<../src/app/(app)/groups/page.tsx>) — drop `useRequireRole('admin')`; members see the list filtered to groups with a slot containing a calendar they own, admins see all.
4. [app-layout-client.tsx](../src/components/navigation/app-layout-client.tsx#L86) — move the `groups` nav item out of the admin-only group into the member set.
5. @src/app/(app)/groups/[id]/page.tsx — drop the admin gate; the page renders for anyone the API serves, and rows carry their editability from the context.
6. [slot-roster.tsx](../src/components/calendar-groups/slot-roster.tsx) — non-editable rows render without write affordances rather than with disabled ones, so nothing suggests an action the viewer cannot take.

Spec use-case: enables **UC-2** and **UC-3** to be performed by their actual actors; no editor ships in this phase.

Tests:

- **Unit**: @src/components/calendar-groups/group-permissions.test.ts — admin edits anything; member edits only owned ids; unknown role edits nothing.
- **Integration**: @src/app/(app)/groups/page.test.tsx — a member sees only groups containing an owned calendar; an admin's existing view is unchanged (assert against the pre-change fixture).
- **Integration**: @src/app/(app)/groups/[id]/page.test.tsx — as a member, the owned calendar's row is editable and every other row exposes no write control; as an admin, all rows are editable.

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](../.claude/skills/plan-feature/resources/ai-models.yaml)). Permission-boundary work across a route, a nav config, and a list page, with a role-gate removal that must not widen anything else.

**Review models**: reviewer Tier 4 — this phase removes a role gate from an existing admin page and introduces the ownership predicate every later editor trusts. A mistake here exposes other people's roster configuration, and the failure is silent. Fixer stays on the project default.

**Reusable skills**: `new-hook` (`useMyCalendars`).

Acceptance: a member with one calendar in one group sees exactly that group in the list, opens it, and finds their own row editable and every other row without a write control; an admin's list and detail views are unchanged from Phase 1.

---

### Phase 3a — Group-scoped window data hooks

**Goal**: the read and write plumbing for availability windows, with typed results for the orphan list and the over-limit rejection. No UI ships in this phase.

**Feature flag**: none — new hooks, no existing caller.

Changes:

1. @src/hooks/calendar-groups/use-group-scoped-windows.ts — list (paginated, per `group_id` + `slot_id`, optionally filtered to one calendar), create, partial update, delete. Every successful write invalidates the slot's list query by predicate, per the invalidation caveat in [use-all-calendars.ts](../src/hooks/calendars/use-all-calendars.ts#L15-L28).
2. Create and update return the write result unwrapped into `{ window, orphanedBookings }` so callers never reach into the generated shape.
3. Delete surfaces a typed `rowGone` result when the API answers 404, distinguishing "someone else deleted it" from a transport failure.
4. @src/lib/utils/api-errors.ts — the over-limit reader and not-found predicate described under **Data Model Changes**.

Spec use-case: shared scaffolding for **UC-1**, **UC-4**, **UC-5**, **UC-6**.

Tests:

- **Unit**: @src/hooks/calendar-groups/use-group-scoped-windows.test.ts — list passes group/slot/calendar params through; create and update return the unwrapped orphan list; a 404 on delete yields `rowGone`; each successful write invalidates the list query.
- **Unit**: @src/lib/utils/api-errors.test.ts — the over-limit body is read into its typed shape; unrelated 400s and 500s are not misread as over-limit.

**Suggested AI model**: Tier 2 (IDs in [resources/ai-models.yaml](../.claude/skills/plan-feature/resources/ai-models.yaml)). One hook module over generated operations, following the established hook pattern.

**Reusable skills**: `new-hook` (`useGroupScopedWindows`).

Acceptance: the hook module lists, creates, updates, and deletes group-scoped windows for a slot, returns the orphan list as a typed field, and reports a deleted-row 404 distinctly — proven by its unit tests, with no component consuming it yet.

---

### Phase 3b — Weekday window grid and unrepresentable rows

**Goal**: an admin (or a calendar's owner) configures a calendar's group-scoped availability through a weekday grid, and sees every window the grid cannot express listed beneath it, deletable and never silently rewritten.

**Feature flag**: none — new component inside the Phase 1 panel shell.

Changes:

1. @src/components/calendar-groups/group-scoped-types.ts — `WeekdayWindow`, the parse/classify functions, and the `GridDiff` computation. Pure, no React, so the data-loss-critical logic is testable directly.
2. @src/components/calendar-groups/group-window-grid.tsx — weekday rows with time ranges, following the shape of [availability-editor.tsx](../src/components/availability/availability-editor.tsx). Serializes with `serializeRRule` from [index.ts:305](../src/lib/datetime/index.ts#L305) as `FREQ=WEEKLY;BYDAY=<DAY>`. Timezone selector defaults to the configured calendar's timezone, falling back to the viewer's.
3. Save issues only the diff's creates, updates, and deletes through the Phase 3a hooks; an unchanged grid issues no request. Controls disable while any write is in flight.
4. @src/components/calendar-groups/unsupported-window-list.tsx — the read-only list of rows the grid cannot express, each showing its times, timezone, and recurrence, with a delete action and copy explaining it cannot be edited here. Deleting a recurring row confirms first, stating the whole series is removed.
5. [slot-roster.tsx](../src/components/calendar-groups/slot-roster.tsx) — the expanded panel renders the grid and the unsupported list, both read-only when the viewer cannot edit that calendar.

Interim state, resolved in Phase 3c: the orphan list returned by a save is not yet surfaced, and an over-limit rejection falls through to the ordinary error toast. Both are wired in the next phase; the grid is correct and useful without them.

Spec use-case: **UC-1** (admin narrows a surgeon to operating days) and **UC-4** (admin opens a calendar an integration configured).

Tests:

- **Unit**: @src/components/calendar-groups/group-scoped-types.test.ts — a weekly single-`BYDAY` rule parses into a grid row; a one-off, a multi-day `BYDAY`, a non-weekly frequency, and an unparseable rule all classify as unrepresentable; the diff produces creates for new rows, updates for changed times, deletes for removed rows, and nothing at all for an untouched grid.
- **Integration**: @src/components/calendar-groups/group-window-grid.test.tsx — ticking two weekdays and saving issues exactly two creates; saving again with no edits issues none; a double submit issues one write; a calendar with one weekly and two unrepresentable rows renders one grid row and two read-only entries, and saving the grid never touches the unrepresentable rows' ids.
- **Integration**: @src/components/calendar-groups/unsupported-window-list.test.tsx — a recurring row's delete confirms before calling; a non-recurring row's delete calls directly; a viewer without edit rights sees no delete action.

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](../.claude/skills/plan-feature/resources/ai-models.yaml)). Grid state, RRULE round-tripping, and diff-based save across several files.

**Review models**: reviewer Tier 4 — a diff bug here deletes roster configuration the admin never saw, and the failure is invisible until bookings stop appearing. The classify-and-diff logic is where that mistake would live. Fixer stays on the project default.

**Reusable skills**: `new-composition` (grid and unsupported list); `add-storybook-story` (empty grid, configured grid, grid with unrepresentable rows).

Acceptance: ticking Tuesday and Thursday at 9am–5pm and saving creates exactly two weekly windows for that calendar in that slot; a calendar whose windows include a one-off and a non-weekly recurrence renders them in the read-only list, and a subsequent grid save leaves both rows unchanged in the API.

---

### Phase 3c — Surface orphaned bookings and plan limits

**Goal**: a save that strands confirmed future bookings says so and lists them; a save rejected as over-limit says which resource, what the usage is, and what the limit is.

**Feature flag**: none — new components consuming Phase 3a's typed results.

Changes:

1. @src/components/calendar-groups/orphaned-bookings-alert.tsx — dismissible alert listing each stranded booking's title, time, and calendar, linking to the booking, and stating plainly that nothing was cancelled. Takes the shared `OrphanedBooking` type so blocks reuse it unchanged.
2. @src/components/calendar-groups/over-limit-alert.tsx — renders the resource, `current_usage`, and `limit` from the typed over-limit body. No upgrade link; the app has no billing surface.
3. [group-window-grid.tsx](../src/components/calendar-groups/group-window-grid.tsx) — a save collects orphan lists across its writes and renders one alert; an over-limit rejection renders the over-limit alert and leaves the author's grid state intact so they can undo part of it and retry.
4. A write that comes back as a deleted row renders "this entry no longer exists" and refetches, rather than surfacing a raw 404.

Spec use-case: **UC-5** (narrowing orphans bookings) and **UC-6** (admin hits the plan limit).

Tests:

- **Unit**: @src/components/calendar-groups/orphaned-bookings-alert.test.tsx — renders one entry per booking with title and formatted time; states nothing was cancelled; dismisses.
- **Unit**: @src/components/calendar-groups/over-limit-alert.test.tsx — renders resource, usage, and limit from the body; renders no upgrade link.
- **Integration**: @src/components/calendar-groups/group-window-grid.test.tsx — a save returning orphans renders the alert and leaves the grid saved; an over-limit rejection renders the over-limit alert, keeps the edited grid state, and leaves the loaded rows unchanged; a 404 on update renders the gone message and triggers a refetch.

**Suggested AI model**: Tier 2 (IDs in [resources/ai-models.yaml](../.claude/skills/plan-feature/resources/ai-models.yaml)). Two presentational components plus branching in an existing save handler.

**Reusable skills**: `new-composition` (both alerts); `add-storybook-story` (populated and empty alert states).

Acceptance: removing a weekday that strands confirmed future bookings saves successfully and renders an alert listing each one with a link, with no booking modified; a save rejected as over-limit renders an alert naming the resource, current usage, and limit, and creates nothing.

---

### Phase 4 — Group-scoped blocked times

**Goal**: an admin or calendar owner adds, edits, and deletes group-scoped blocks for a calendar in a slot, including one-off and recurring blocks with a reason.

**Feature flag**: none — new hook and components in the existing panel.

Changes:

1. @src/hooks/calendar-groups/use-group-scoped-blocks.ts — the windows hook's shape with `reason` added and the block write result unwrapped to `{ block, orphanedBookings }`.
2. @src/components/calendar-groups/group-block-list.tsx — the rows for one calendar in one slot, each showing times, timezone, recurrence, and reason, with edit and delete actions. Recurring deletes confirm, stating the series is removed.
3. @src/components/calendar-groups/group-block-form.tsx — date, start and end time, timezone, reason, and an optional repeat sub-form, following [blocked-time-form.tsx](../src/components/availability/blocked-time-form.tsx) and reusing `serializeRRule`. `rrule_string` on edit is tri-state: untouched, cleared, or replaced.
4. Both alerts from Phase 3c are reused as-is — every block create and update runs orphan detection on the backend, so the alert fires more often here than for windows.
5. [slot-roster.tsx](../src/components/calendar-groups/slot-roster.tsx) — the panel gains the blocks section, read-only when the viewer cannot edit that calendar.

Spec use-case: **UC-3** (member blocks one week for one activity).

Tests:

- **Unit**: @src/hooks/calendar-groups/use-group-scoped-blocks.test.ts — reason round-trips on create and update; omitting `rrule_string` on update leaves it unchanged while `null` clears it; a 404 on delete yields `rowGone`.
- **Integration**: @src/components/calendar-groups/group-block-form.test.tsx — a one-off block submits without an rrule; toggling repeat submits the serialized rule; `start_time >= end_time` is rejected by the form before any request.
- **Integration**: @src/components/calendar-groups/group-block-list.test.tsx — a save returning orphans renders the shared alert; a recurring delete confirms first; a viewer without edit rights sees the rows and no actions.

**Suggested AI model**: Tier 2 (IDs in [resources/ai-models.yaml](../.claude/skills/plan-feature/resources/ai-models.yaml)) for the hook and list; step up to Tier 3 for the recurrence form's tri-state edit semantics.

**Reusable skills**: `new-hook` (`useGroupScopedBlocks`); `new-composition` (list and form); `add-storybook-story` (empty list, populated list, form with repeat open).

Acceptance: adding two one-off blocks with a reason for a calendar in a slot creates two blocks visible in the list; editing one without touching recurrence leaves its rule unchanged; deleting a recurring block confirms first and removes the series.

---

### Phase 5 — Group-scoped quota rules

**Goal**: an admin or calendar owner caps how many bookings a calendar takes through a group slot per day, week, or month.

**Feature flag**: none — new hook and component in the existing panel.

Changes:

1. @src/hooks/calendar-groups/use-group-scoped-quota.ts — list, create, partial update, delete. Create returns the rule directly; there is no write result and no orphan list anywhere in this surface.
2. @src/components/calendar-groups/group-quota-rules.tsx — the rules for one calendar in one slot: period, cap, and add / edit / delete. Helper text on the period field states that day, week, and month boundaries are measured in UTC. No consumption indicator.
3. The one-rule-per-`(calendar, slot, period)` constraint surfaces as a form-level message from the API's `non_field_errors`, not an unhandled failure. A calendar may hold a daily and a weekly rule at once.
4. [slot-roster.tsx](../src/components/calendar-groups/slot-roster.tsx) — the panel gains the quota section, read-only when the viewer cannot edit that calendar.

Spec use-case: **UC-2** (member caps their own weekly load).

Tests:

- **Unit**: @src/hooks/calendar-groups/use-group-scoped-quota.test.ts — create and update pass period and cap; a successful write invalidates the list.
- **Integration**: @src/components/calendar-groups/group-quota-rules.test.tsx — a cap below 1 is rejected by the form; a duplicate period renders the API's message on the form rather than a toast-and-forget; the UTC helper text is present on the period field; a daily and a weekly rule coexist; a viewer without edit rights sees the rules and no actions.

**Suggested AI model**: Tier 2 (IDs in [resources/ai-models.yaml](../.claude/skills/plan-feature/resources/ai-models.yaml)). One hook plus a small form over an established pattern.

**Reusable skills**: `new-hook` (`useGroupScopedQuota`); `new-composition` (the quota section); `add-storybook-story` (no rules, one rule, duplicate-period error).

Acceptance: adding a "3 per week" rule for a calendar in a slot saves and lists it with UTC boundary helper text visible; adding a second weekly rule for the same calendar and slot renders the constraint message on the form; adding a daily rule alongside the weekly one succeeds.

---

### Phase 6 — Effective availability preview

**Goal**: an admin can see, without simulating a booking, which days a calendar actually comes back free for the group after its base availability, windows, and blocks are resolved.

**Feature flag**: none — a read-only addition to the existing panel.

Changes:

1. @src/hooks/calendar-groups/use-group-availability-preview.ts — wraps the group availability operation over a date range, requesting per-day ranges and reducing the response to "is this calendar among the free candidates for this slot on this day". Reuses the operation [use-group-booking.ts](../src/hooks/calendar-groups/use-group-booking.ts) already calls; the booking hook is not modified.
2. @src/components/calendar-groups/group-availability-preview.tsx — a collapsed-by-default strip with a range picker defaulting to the coming seven days, showing per-day free / not free for this calendar in this slot, and an explicit empty state when nothing in the range is available.
3. The query runs only when the strip is opened, so the panel's default cost is unchanged.

Spec use-case: **UC-7** (admin checks the effect before trusting it).

Tests:

- **Unit**: @src/hooks/calendar-groups/use-group-availability-preview.test.ts — per-day ranges are built from the picked range; the response reduces to the right per-day answer for the calendar in question; the query does not fire until enabled.
- **Integration**: @src/components/calendar-groups/group-availability-preview.test.tsx — the strip issues no request until opened; a range where the calendar is never free renders the empty state rather than an error; a mixed range renders free and not-free days distinctly.

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](../.claude/skills/plan-feature/resources/ai-models.yaml)). Range construction, response reduction, and lazy query enabling over an operation shared with the booking flow.

**Reusable skills**: `new-hook` (`useGroupAvailabilityPreview`); `new-composition` (the preview strip); `add-storybook-story` (collapsed, mixed range, empty range).

Acceptance: opening the preview for a calendar configured Tuesdays and Thursdays over the coming week shows those two days free and the rest not, and issues no availability request until it is opened.

## 6. Risk & Rollout Notes

**No feature flag.** Justified in **Guiding Decisions**: every phase except Phase 2 is a new route, new hook, or new component with no existing caller. Phase 2 changes one existing page's visibility and one nav entry, ships alone, and is reverted with a single `git revert` — a smaller and better-understood rollback than a flag this repo would have to build first. Consequently there is no flag-removal phase.

**Backend deploy ordering.** The endpoints exist only on the backend's `feat/calendar-group-scoped-availability` branch. Every phase here is implementable and unit-testable now, because tests mock the generated client at the module boundary. Nothing is user-visible until the backend merges and deploys. If the frontend ships first, the detail route renders its group and slots (existing endpoints) and every group-scoped list query fails — so Phase 1 through Phase 6 should be released only after the backend is deployed, or the detail route link in the groups table held back until then.

**Contract drift while the backend is unmerged.** If the backend branch changes shape before merging, re-running codegen surfaces the drift as type errors rather than runtime failures. Re-run the schema refresh and regenerate before starting each phase after a backend push, and treat a Phase 0 redo as cheap.

**Silent data loss is the main correctness risk.** The grid save is diff-based and must never touch rows it did not parse. This is why the classify-and-diff logic lives in pure functions with their own unit tests, why unrepresentable rows are rendered rather than hidden, and why Phase 3b runs a Tier 4 reviewer.

**Permission widening is the main security risk.** Phase 2 removes a role gate. Its acceptance test asserts both that members see only their own groups and that a member sees no write control for a calendar they do not own. The ownership predicate is a pure function with direct tests, so the boundary is not buried in component state.

**Non-disclosure is easy to break with helpful copy.** Any empty state, error message, or loading state reachable from a 404 must be identical across the missing / other-org / unauthorized cases. Phase 1's integration test asserts identical rendering across all three fixtures; keep that assertion when later phases add to the page.

**Metering behavior change.** As of the backend branch, all blocked time counts toward the `availability_windows` plan limit. Nothing in this plan displays usage, so the over-limit alert in Phase 3c is the first and only place a limit surfaces. Whoever adds a usage display later must count windows plus blocked time.

**Rollback.** Every phase is a revert. Phase 0's revert restores the previous generated client and breaks any later phase still merged, so revert in reverse order. Phase 2's revert restores the admin-only gate and the admin-only nav entry; members who had reached the detail route lose access, and no data is affected.

**No migrations, locks, partitions, or backfills** — this repo has no database and stores nothing.

## 7. Open Questions

1. **Does the calendar groups list endpoint return groups to a non-admin member?** Phase 2 assumes it does. _Recommended default:_ build Phase 2 on the list endpoint and verify against a running backend before Phase 2 is accepted. If the endpoint is admin-scoped, the member entry point moves to a "your groups" section on the availability page and Phase 2 grows by roughly 80 LoC. _Owner:_ backend team, or a direct call against the branch.
2. **Does a non-admin's calendar list return only their own calendars?** The ownership predicate in Phase 2 depends on it. _Recommended default:_ assume yes and assert it in the Phase 2 integration test's fixture; if the list is org-wide for members, ownership must come from a different signal and Phase 2 blocks on the backend exposing one. _Owner:_ backend team.
3. **When does the backend branch merge and deploy?** _Recommended default:_ implement all phases now, gate release on the backend deploy, and re-run codegen before each phase if the branch moves. _Owner:_ backend team.
4. **Should the window form warn at save time when a window falls outside base availability?** Phase 6's preview shows the effect afterward. _Recommended default:_ preview only; revisit if admins report saves that appear to do nothing. _Owner:_ whoever owns the roster experience.
5. **Does the roster panel need a per-calendar timezone at all, or would one panel-level timezone do?** The plan follows the spec's per-row decision. _Recommended default:_ keep per-row, since the API stores it per row; collapse to a panel default only if the picker proves noisy in use. _Owner:_ product.

## 8. Touch List

**Phase 0**

- Commit: `schema.yml`, [types.gen.ts](../src/client/types.gen.ts), [sdk.gen.ts](../src/client/sdk.gen.ts), [react-query.gen.ts](../src/client/@tanstack/react-query.gen.ts), [index.ts](../src/client/index.ts)

**Phase 1**

- New: @src/app/(app)/groups/[id]/page.tsx, @src/app/(app)/groups/[id]/page.test.tsx
- New: @src/hooks/calendar-groups/use-calendar-group.ts, @src/hooks/calendar-groups/use-calendar-group.test.ts
- New: @src/components/calendar-groups/group-detail-view.tsx, @src/components/calendar-groups/slot-roster.tsx, @src/components/calendar-groups/group-not-found.tsx (+ colocated stories and tests)
- Edited: [groups-table.tsx](../src/components/calendar-groups/groups-table.tsx), [groups-table.test.tsx](../src/components/calendar-groups/groups-table.test.tsx)

**Phase 2**

- New: @src/hooks/calendars/use-my-calendars.ts (+ test)
- New: @src/components/calendar-groups/group-permissions.ts (+ test)
- Edited: [page.tsx](<../src/app/(app)/groups/page.tsx>), [page.test.tsx](<../src/app/(app)/groups/page.test.tsx>), [app-layout-client.tsx](../src/components/navigation/app-layout-client.tsx), @src/app/(app)/groups/[id]/page.tsx, @src/components/calendar-groups/slot-roster.tsx

**Phase 3a**

- New: @src/hooks/calendar-groups/use-group-scoped-windows.ts (+ test)
- Edited or new: @src/lib/utils/api-errors.ts (+ test)

**Phase 3b**

- New: @src/components/calendar-groups/group-scoped-types.ts (+ test)
- New: @src/components/calendar-groups/group-window-grid.tsx, @src/components/calendar-groups/unsupported-window-list.tsx (+ stories and tests)
- Edited: @src/components/calendar-groups/slot-roster.tsx

**Phase 3c**

- New: @src/components/calendar-groups/orphaned-bookings-alert.tsx, @src/components/calendar-groups/over-limit-alert.tsx (+ stories and tests)
- Edited: @src/components/calendar-groups/group-window-grid.tsx (+ test)

**Phase 4**

- New: @src/hooks/calendar-groups/use-group-scoped-blocks.ts (+ test)
- New: @src/components/calendar-groups/group-block-list.tsx, @src/components/calendar-groups/group-block-form.tsx (+ stories and tests)
- Edited: @src/components/calendar-groups/slot-roster.tsx

**Phase 5**

- New: @src/hooks/calendar-groups/use-group-scoped-quota.ts (+ test)
- New: @src/components/calendar-groups/group-quota-rules.tsx (+ story and test)
- Edited: @src/components/calendar-groups/slot-roster.tsx

**Phase 6**

- New: @src/hooks/calendar-groups/use-group-availability-preview.ts (+ test)
- New: @src/components/calendar-groups/group-availability-preview.tsx (+ story and test)
- Edited: @src/components/calendar-groups/slot-roster.tsx

**Cross-repo**

- `vinta-schedule` backend, branch `feat/calendar-group-scoped-availability` — must merge and deploy before any phase is user-visible. No change required in that repo for this plan.
