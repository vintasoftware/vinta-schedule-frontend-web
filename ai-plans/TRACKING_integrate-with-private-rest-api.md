# Tracking — Integrate with private REST API

- **Plan**: [2026-06-05-INTEGRATE_WITH_PRIVATE_REST_API_IMPLEMENTATION_PLAN.md](2026-06-05-INTEGRATE_WITH_PRIVATE_REST_API_IMPLEMENTATION_PLAN.md)
- **Started**: 2026-06-05
- **Last updated**: 2026-06-05
- **Feature flag**: none (additive surface)
- **Branch pattern**: `plan/integrate-with-private-rest-api/phase-{id}`, stacked
- **run_options**: `pause_between_phases: false` (auto-flow), `generate_inline_comments: true`, `scope: all 44 executable phases`
- **E2E policy (changed 2026-06-05 after Phase 2)**: per-phase Playwright specs are **deferred** — the user will build the full e2e suite in an optimized way after implementation. The 0f harness + QA_USE_CASES.md stay; phases 3+ do NOT write `PA###`/`PR###` specs. Already-written `PA001`/`PA002` remain (harmless, superseded later).

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

### Phase 1 — List team (admin) ✅ [TEMPLATE for datatable phases]

- **Status**: done, PR opened.
- **Model**: `claude-sonnet-4-6` (plan Tier 2; tiered up — pattern-setting for 6 phases).
- **Branch**: `plan/integrate-with-private-rest-api/phase-1` (base `phase-0f`, stacked).
- **PR**: (published below) — inline comments.
- **Commits**: `5f1b3e1` team list, `73b2a9a` review fixes.
- **Summary**: `src/hooks/team/use-team-members.ts` (`organizationMembersList`, `page`→`offset`/`limit` mapping, `TEAM_MEMBERS_QUERY_KEY` for phases 4/6 invalidation), `src/components/team/team-table.tsx` (`DataTable<TeamMember>`, name/email/role/status badges), admin-gated `/team` route, nav `href` wiring (added to `SidebarNavItem`). Review (FIX-FIRST) fixed 3 blockers: inert search → `showSearch` opt on shared DataTable; un-gated render → `if(!isAllowed) return null`; tautological e2e; + nav startsWith false-positive, invalidation-predicate doc, pagination-offset test, story column dedup.
- **Contract reality**: `organizationMembersList` is `limit`/`offset` only — NO search/ordering. Team is paginated-only (`showSearch={false}`). The plan's "searchable/sortable" goal can't be met for this endpoint; later phases keep search where their op supports it.
- **Patterns established (copied by 2,7,11,28,30,37)**: hook→DataTable query mapping, `showSearch` opt, admin-gate early-return, nav-href, predicate invalidation doc, pagination-offset test.
- **Gate**: typecheck/test(159)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 2 — List pending invitations (admin) ✅

- **Status**: done, PR opened.
- **Model**: `claude-haiku-4-5` (plan Tier 2; template held with cheaper model + review).
- **Branch**: `plan/integrate-with-private-rest-api/phase-2` (base `phase-1`, stacked).
- **PR**: (published below) — inline comments.
- **Commits**: `7b7fbb5` invitations tab, `b204166` review fixes.
- **Summary**: `useInvitations` (`invitationsList`, always `is_accepted:false`, search→`email`, offset pagination, `INVITATIONS_QUERY_KEY` for phases 3/4/5). `InvitationsTable` (email/expiry/pending badge). `/team` refactored to Team + Invitations **tabs**. Added a `prefix` option to the shared `useDataTableQuery` so the two tabs namespace their URL state (`inv_*`) — Phase 1 unaffected. Review (FIX-FIRST, haiku output) fixed: stories importing vitest (Storybook-broken), cross-tab URL contamination, UTC→local expiry zone, dead status branch, component-level tests.
- **Shared-infra change**: `useDataTableQuery({ prefix })` — reusable wherever two tables share a page.
- **Gate**: typecheck/test(185)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 3 — Invite a member (admin) ✅

- **Status**: done, PR opened.
- **Model**: `claude-sonnet-4-6` (carries real idempotency logic).
- **Branch**: `plan/integrate-with-private-rest-api/phase-3` (base `phase-2`, stacked).
- **PR**: (published below) — inline comments.
- **Commits**: `745b9e2` invite dialog, `3b90a1f` review fixes.
- **Summary**: `useCreateInvitation` (`invitationsCreate` + predicate invalidation), `useResendInvitation` (`invitationsResendCreate`, signature `(id, email)` — **Phase 4 reuses this**), `InviteMemberDialog` (rhf+zod; on existing pending+non-expired email → no create, surface existing + Resend). "Invite member" button in the Invitations toolbar (`toolbarActions` prop). Review (FIX-FIRST) fixed BLOCKER: resend empty body → `{email}`; + expired false-block, email trim, double-click race test, real-component story.
- **Phase 4 dependency**: `use-resend-invitation.ts` already exists with the final `(id, email)` signature — Phase 4 imports/extends it (debounce + row action), does NOT recreate.
- **Gate**: typecheck/test(197)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 4 — Resend an invitation (admin) ✅

- **Status**: done, PR opened.
- **Model**: `claude-haiku-4-5` (small — reused Phase 3 hook).
- **Branch**: `plan/integrate-with-private-rest-api/phase-4` (base `phase-3`, stacked).
- **PR**: (published below) — inline comments.
- **Commits**: `21ece0a` resend row action.
- **Summary**: per-row **Resend** action column on `InvitationsTable` via a `createColumns(pendingRowIds, onResend)` factory; per-row in-flight disable (`Set<number>`) prevents double-fire; success/error sonner toasts; reuses `useResendInvitation` from Phase 3 (expiry refreshes via its invalidation). Accepted on focused orchestrator review (low-risk row action; core handler read + gate verified) — no separate reviewer agent.
- **Gate**: typecheck/test(201)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 5 — Revoke an invitation (admin) ✅

- **Status**: done, PR opened.
- **Model**: `claude-haiku-4-5` (small — mirrors Phase 4 row-action pattern).
- **Branch**: `plan/integrate-with-private-rest-api/phase-5` (base `phase-4`, stacked).
- **PR**: (published below) — inline comments.
- **Commits**: `cf747e2` revoke row action.
- **Summary**: `useRevokeInvitation` (`invitationsDestroy` + predicate invalidation), Revoke row action with `AlertDialog` confirm beside Resend; per-row in-flight disable; cancel = no-op; success toast. Accepted on focused orchestrator review (low-risk mirror; hook + confirm/cancel tests + gate verified).
- **Gate**: typecheck/test(206)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 6 — Disable a user (admin) ✅

- **Status**: done, PR opened.
- **Model**: `claude-haiku-4-5` (mirror of phase 4/5 row-action).
- **Branch**: `plan/integrate-with-private-rest-api/phase-6` (base `phase-5`, stacked).
- **PR**: (published below) — inline comments.
- **Commits**: `6fae99c` disable-user row action.
- **Summary**: `useDisableUser` (`organizationMembersDeactivateCreate`) + `useReactivateUser` (`organizationMembersReactivateCreate`), both predicate-invalidating the team query. Status-aware team row action: active → Disable (AlertDialog confirm), disabled → Re-enable. Per-row in-flight disable + toast. Access denial via Phase 0a (not re-implemented). No `as any` (deactivate body optional, none sent). Accepted on focused orchestrator review.
- **Gate**: typecheck/test(208)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

## Team & invitations block complete ✅ (phases 1–6)

### Phase 7 — List my calendars (member) ✅

- **Status**: done, PR opened. **Model**: `claude-haiku-4-5`. **Branch**: `phase-7` (base `phase-6`).
- **PR**: (published below). **Commits**: `f9c4f58`.
- **Summary**: `useMyCalendars` (`calendarList`, limit/offset, `MY_CALENDARS_QUERY_KEY`), `CalendarsTable` (`showSearch={false}`; name/type/provider/status badges), member route `/calendars` (no admin gate), nav href wired. Sync-state column dropped (not on the `Calendar` type). Accepted on focused review (team-template mirror).
- **Gate**: typecheck/test(217)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 8 — Create a calendar (member) ✅

- **Status**: done, PR opened. **Model**: `claude-haiku-4-5`. **Branch**: `phase-8` (base `phase-7`).
- **PR**: (published below). **Commits**: `75bd56b`.
- **Summary**: `useCreateCalendar` (`calendarCreate` + predicate invalidation of my-calendars), `CreateCalendarDialog` (rhf+zod; `CalendarWritable` requires only `name`, + optional description — no missing-field 400), "New calendar" toolbar action. Accepted on focused review (mirrors reviewed Phase 3 dialog).
- **Gate**: typecheck/test(228)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 9 — Delete a calendar (member) ✅ [re-scoped from Disable]

- **Status**: done, PR opened. **Model**: `claude-haiku-4-5`. **Branch**: `phase-9` (base `phase-8`).
- **PR**: (published below). **Commits**: `d23f248` plan re-scope, `2bd955f` delete row action.
- **Re-scope**: `Calendar.is_active` is read-only (not on `CalendarWritable`/`PatchedCalendarWritable`), no disable endpoint → user chose hard DELETE. Plan Phase 9 + Open Q1 amended. Resolves Open Question #1.
- **Summary**: `useDeleteCalendar` (`calendarDestroy` + predicate invalidation), Delete row action with destructive `AlertDialog` confirm + per-row in-flight disable; calendars table refactored to `createColumns` factory. NOTE: implementer didn't commit — orchestrator staged + committed the phase code (`2bd955f`).
- **Gate**: typecheck/test(234)/lint(0 err)/format (phase files clean) green; build only pre-existing `/auth/verify-email`.

### Phase 10 — Request a calendar to sync (member) ✅

- **Status**: done, PR opened. **Model**: `claude-haiku-4-5`. **Branch**: `phase-10` (base `phase-9`).
- **PR**: (published below). **Commits**: `e727b9d`.
- **Summary**: `useRequestCalendarSync` (`calendarRequestSyncCreate`); Sync row action (non-destructive, fire-and-toast "Sync started", per-row debounce). `CalendarSyncRequest` needs a window → default range now−1mo→+3mo, `should_update_events:true` (no prompt, keeps one-click UX). No invalidation (async sync, no live tracking). Accepted on focused review.
- **Gate**: typecheck/test(239)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 11 — List all calendars incl. resources & bundles (admin) ✅

- **Status**: done, PR opened. **Model**: `claude-haiku-4-5`. **Branch**: `phase-11` (base `phase-10`).
- **PR**: (published below). **Commits**: `fdee966`.
- **Summary**: `useAllCalendars` (`calendarList`, `ALL_CALENDARS_QUERY_KEY`), `AllCalendarsTable` (admin-gated `/all-calendars`; type badges for personal/resource/virtual/bundle + provider + status; `showSearch={false}`), nav href wired. Accepted on focused review.
- **API limits flagged**: no type-filter param (badges only, no inert filter); org-wide scope is backend RBAC (not frontend-verified). Added a member-style Sync action — **Phase 35** replaces with admin-sync (`calendarAdminSyncCreate`).
- **Gate**: typecheck/test(253)/lint(0 err)/format (code clean) green; build only pre-existing `/auth/verify-email`.

## Calendars block complete ✅ (phases 7–11)

### Phase 12 — View events as a list (member) ✅ [TEMPLATE for events views 13–15]

- **Status**: done, PR opened. **Model**: `claude-sonnet-4-6` (pattern-setting + real logic). **Branch**: `phase-12` (base `phase-11`).
- **PR**: (published below). **Commits**: `b91ecac` events list, `dbb8f17` review fixes.
- **Summary**: `useCalendarEvents({range, calendarId?})` (`calendarEventsList`, **overlap** time-range via `toApiRange`, `limit:1000` + `truncated` flag, `invalidateCalendarEvents` predicate helper for phases 16/20/21/22–24), `EventsView` (owns view+anchor(zoned)+calendarId state, renders Phase 0e `CalendarView` agenda mode), member route `/events`, nav href. Review (FIX-FIRST) fixed 2 blockers (invalidation no-op, spurious `'use client'`) + overlap-range, pagination truncation, agenda-window contract, zoned `initialDate`, strengthened tests, stubbed stories.
- **Patterns for 13–15**: view/anchor/calendarId state on `EventsView`; `agendaLength` prop on `CalendarView`; overlap range; `invalidateCalendarEvents`.
- **Gate**: typecheck/test(272)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 13 — View events as a month calendar (member) ✅

- **Status**: done, PR opened. **Model**: `claude-haiku-4-5`. **Branch**: `phase-13` (base `phase-12`).
- **PR**: (published below). **Commits**: `a680729`.
- **Summary**: List/Month view toggle on `EventsView`; Month uses `eventRange('month',...)` + `CalendarView` month grid; same events as list. Structured so Phase 14 adds Week trivially. Accepted on focused review.
- **Flake note**: one flaky run (2 transient timing failures, green on re-run ×2) — a debounce/async timing test under load, not Phase 13 logic. Watch in the test-hardening pass.
- **Gate**: typecheck/test(276)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 14 — View events as a week calendar (member) ✅

- **Status**: done, PR opened. **Model**: `claude-haiku-4-5`. **Branch**: `phase-14` (base `phase-13`).
- **PR**: (published below). **Commits**: `32f2708`.
- **Summary**: Week option added to the events view toggle (List/Week/Month); `eventRange('week',...)` + `CalendarView` week grid; view parity. Stable on two test runs. Accepted on focused review.
- **Gate**: typecheck/test(279)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 15 — View events for one specific calendar (member) ✅

- **Status**: done, PR opened. **Model**: `claude-haiku-4-5`. **Branch**: `phase-15` (base `phase-14`).
- **PR**: (published below). **Commits**: `5b81629`.
- **Summary**: `CalendarScopePicker` (Phase 0e) data-bound via `useMyCalendars` (Phase 7); selection synced to `?calendar=` URL param → `calendarId` → `useCalendarEvents` `calendar` filter → refilters list/month/week. Events page wrapped in `<Suspense>` for `useSearchParams`. Two green runs. Accepted on focused review.
- **Gate**: typecheck/test(283)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

## Events block complete ✅ (phases 12–15)

### Phase 16 — Single booking with co-booked calendars (member) ✅ [establishes shared conflict-surface]

- **Status**: done, PR opened. **Model**: `claude-sonnet-4-6` (most complex phase). **Branch**: `phase-16` (base `phase-15`).
- **PR**: (published below). **Commits**: `1924b7e` booking flow, `a7a1745` review fixes.
- **Summary**: `src/components/bookings/` — `ConflictSurface` (SHARED, `CalendarConflict[]` + onProceed/onAdjust, warn-but-allow-override), `booking-form` (rhf/zod: time/title/attendees/primary+co-booked calendars; conditional render of surface vs form), `new-booking-button`. `src/hooks/bookings/` — `use-availability-check` (un/available windows), `use-create-booking` (primary `calendarEventsCreate` + per-co-booked `blockedTimesCreate`, partial-failure surfacing, required empty arrays). Review (FIX-FIRST) fixed: form-hidden CSS bug, untested create-once + override-rejected (now tested), nearest-free query, data guard, primitives, conflict story.
- **Reused by 17/18/21**: `ConflictSurface` props shape; `use-availability-check`; co-booking orchestration.
- **Gate**: typecheck/test(318)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 17 — Recurring booking (member) ✅

- **Status**: done, PR opened. **Model**: `claude-sonnet-4-6`. **Branch**: `phase-17` (base `phase-16`).
- **PR**: (published below). **Commits**: `3de53d5`.
- **Summary**: Repeat toggle + recurrence sub-form (freq/interval/end/byday) on the Phase 16 booking form; builds a Phase 0c `RecurrenceRule` → `serializeRRule` → `rrule_string` on the event; reuses `ConflictSurface`. Repeat-gated (off → no recurrence sent). Accepted on focused review (form is Phase 16-reviewed, serde is Phase 0c-tested).
- **Gate**: typecheck/test(324)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 18 — Book on a Calendar Group (member) ✅ [Tier 4 spike — RESOLVED]

- **Status**: done, PR opened. **Model**: `claude-opus-4-8` (Tier 4). **Branch**: `phase-18` (base `phase-17`).
- **PR**: (published below). **Commits**: `a5cd5db` group flow, `2ca150f` review fixes.
- **Summary**: `use-calendar-groups` + `use-group-booking` (3 group ops + pure satisfiability helpers `slotRequiredCount`/`isSlotSatisfiable`/`isSelectionComplete`/`buildSlotAvailability`), `group-booking-flow` dialog (per-slot pickers, required-count enforcement, only-free selectable, unsatisfiable hard-block, timezone picker, race Alert on submit-race), `book-group-button`. Sends `slot_selections:[{slot_id,calendar_ids}]`. Review (FIX-FIRST) fixed: ConflictSurface(conflicts=[]) misuse → bespoke race Alert; timezone picker; backend-rejection test; required_count edge tests; Label atom; story.
- **SPIKE RESOLVED**: group model maps cleanly to the API (no type gaps; satisfiability is pure client-side). **Phase 29 (create group) is safe.** Calendar-grid availability _overlay_ (RBC background bands) is a separate unproven concern, NOT needed for group booking — Phase 0e `eventRenderer` untouched + sufficient.
- **Gate**: typecheck/test(351)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 19 — Manage attendees on an event (member) ✅

- **Status**: done, PR opened. **Model**: `claude-sonnet-4-6`. **Branch**: `phase-19` (base `phase-18`).
- **PR**: (published below). **Commits**: `dae1cb0`.
- **Summary**: `useUpdateAttendees` (`calendarEventsPartialUpdate` + `invalidateCalendarEvents`), `EventAttendeesEditor` (3 sections: internal `attendances:[{user_id}]`, external `external_attendances:[{external_attendee:{email,name}}]`, resource `resource_allocations:[{calendar}]`; add/remove rows; PATCH-replaces-arrays). Wired to calendar event-click (`onSelectEvent` → sheet). Accepted on focused review (shapes verified, helper reused).
- **API limitation**: internal attendee uses a manual numeric `user_id` (membership exposes no user id) — same as the booking form; flagged for backend enhancement.
- **Gate**: typecheck/test(362)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 20 — Cancel a booking (member) ✅ [builds shared scope-prompt-dialog]

- **Status**: done, PR opened. **Model**: `claude-sonnet-4-6`. **Branch**: `phase-20` (base `phase-19`).
- **PR**: (published below). **Commits**: `5c7df63`.
- **Summary**: `ScopePromptDialog` (SHARED, `RecurringScope='this'|'following'|'all'`, reused by 21–24), `useCancelBooking` (scope→op: this→`createException{exception_date,is_cancelled}`, following→`bulkModify{modification_start_date,is_cancelled}`, all→`calendarEventsDestroy`). Cancel action on the event sheet; non-recurring→confirm, recurring→scope prompt. Verified op bodies against real types (no `as any`). Co-booked blocked-times release = backend cascade (documented). Accepted on focused review (verified the highest-risk op-body mapping myself).
- **Gate**: typecheck/test(388)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 21 — Reschedule a booking (member) ✅

- **Status**: done, PR opened. **Model**: `claude-sonnet-4-6` (first attempt hit a transient API overload after creating the hook; resumed). **Branch**: `phase-21` (base `phase-20`).
- **PR**: (published below). **Commits**: `ae56c9d`.
- **Summary**: `useRescheduleBooking` (scope→op: non-recurring/all→`calendarEventsPartialUpdate` new times, this→`createException` modified times, following→`bulkModify` offsets), `RescheduleDialog` (new-time form → availability re-check → `ConflictSurface` warn-but-allow-override → recurring `ScopePromptDialog` → apply). Reschedule action on the event sheet. Reuses Phase 16/19/20 pieces. No `as any`. Accepted on focused review (mapping verified via typecheck).
- **Gate**: typecheck/test(404)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

## Bookings block complete ✅ (phases 16–21)

### Phase 22 — Adjust one instance (member) ✅ [wired all 3 edit scopes]

- **Status**: done, PR opened. **Model**: `claude-sonnet-4-6`. **Branch**: `phase-22` (base `phase-21`).
- **PR**: (published below). **Commits**: `7f9aaa6`.
- **Summary**: `useEditOccurrence` (this→`createException` modified fields, following→`bulkModify`, all→`partialUpdate`; non-recurring→`partialUpdate` direct), `EditEventDialog` (title/desc/time form; recurring→`ScopePromptDialog`→scoped edit; non-recurring→direct). Edit action on the event sheet. No `as any`. **Phases 23/24 op-level wiring already done here** — they become acceptance/test phases. Accepted on focused review.
- **Gate**: typecheck/test(425)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 23 — Adjust this and following (member) ✅

- **Status**: done, PR opened. **Model**: `claude-haiku-4-5` (light — op wired in Phase 22). **Branch**: `phase-23` (base `phase-22`).
- **PR**: (published below). **Commits**: `6c17777`.
- **Summary**: split-point acceptance test (`bulkModify` with `modification_start_date` = occurrence date → earlier untouched, this+later change), named `useEditThisAndFollowing()` wrapper, dialog integration tests. Accepted on focused review.
- **Gate**: typecheck/test(428)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 24 — Adjust all instances (member) ✅

- **Status**: done, PR opened. **Model**: `claude-haiku-4-5` (light — op wired in Phase 22). **Branch**: `phase-24` (base `phase-23`).
- **PR**: (published below). **Commits**: `48f031c`.
- **Summary**: whole-series acceptance test (`all` → `partialUpdate` on series root; createException/bulkModify not called), named `useEditWholeSeries()` wrapper. Accepted on focused review.
- **Gate**: typecheck/test(431)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

## Recurring-scope edits complete ✅ (phases 22–24)

### Phase 25 — Edit my availability (member) ✅

- **Status**: done, PR opened. **Model**: `claude-sonnet-4-6`. **Branch**: `phase-25` (base `phase-24`).
- **PR**: (published below). **Commits**: `818bb20`.
- **Summary**: `useAvailableTimes` (`availableTimesList` + `availableTimesBulkCreateCreate`; weekly = `rrule_string` FREQ=WEEKLY;BYDAY, ad-hoc = no rrule), `AvailabilityEditor` (7-row weekly grid via `weekdayMatrix` + ad-hoc section), member route `/availability`, nav href. No `as any`. Accepted on focused review.
- **Known limitation (follow-up)**: form starts EMPTY — doesn't yet de-serialize existing rrule windows back into the grid (would use Phase 0c `parseRRule`). Round-trip + recompute acceptance met; load-existing is a flagged follow-up.
- **Gate**: typecheck/test(451)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 26 — Create blocked times (member) ✅

- **Status**: done, PR opened. **Model**: `claude-haiku-4-5`. **Branch**: `phase-26` (base `phase-25`).
- **PR**: (published below). **Commits**: `9bd1da8`.
- **Summary**: `useBlockedTimes` (`blockedTimesBulkCreateCreate`; one-off no rrule, recurring with `rrule_string`), `BlockedTimeForm` (date/start/end + Repeat sub-form reusing `serializeRRule`) on a "Blocked times" tab of `/availability`. No `as any`. ResizeObserver polyfill added to vitest.setup. Accepted on focused review.
- **Gate**: typecheck/test(461)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

### Phase 27 — Check another user's availability (member) ✅

- **Status**: done, PR opened. **Model**: `claude-sonnet-4-6`. **Branch**: `phase-27` (base `phase-26`).
- **PR**: (published below). **Commits**: `e43d5b9`.
- **Summary**: `useUserAvailability` (available/unavailable windows for a target calendar + range), `UserAvailabilityView` (colleague picker + range + free/busy bands; no titles → privacy per Open Q3), "Colleague availability" tab on `/availability`. No `as any`. Accepted on focused review.
- **Known limitation (API gap)**: no member→calendar mapping (membership has no calendar id), so the target is identified by calendar id manually until the backend exposes it. Flagged follow-up.
- **Gate**: typecheck/test(481)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

## Availability block complete ✅ (phases 25–27)

### Phase 28 — List Calendar Groups (admin) ✅

- **Status**: done, PR opened. **Model**: `claude-haiku-4-5`. **Branch**: `phase-28` (base `phase-27`).
- **PR**: (published below). **Commits**: `b57c456`.
- **Summary**: `useCalendarGroups` extended for `DataTableQuery` (Phase 18 usage preserved), `GroupsTable` (name/description/slot-count, `showSearch` on — `name` filter), admin-gated `/groups`, nav href. Accepted on focused review.
- **Gate**: typecheck/test(486)/lint(0 err)/format green; build only pre-existing `/auth/verify-email`.

## Current Phase

- **Phase 29 — Create a Calendar Group (admin)** (Tier 3) — starting (nested slot/pool/required-count builder).

## Remaining Phases

29–38 (use-cases).

## Deferred / Superseded

- **Phase 0b** — MSW mock layer — superseded (live API).
- **Phase 39** — mock→live swap — superseded (live API).
- No cross-repo phases. No flag-removal phase (no feature flag).
