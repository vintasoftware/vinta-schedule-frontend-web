# Integrate with private REST API — Implementation Plan

> **Amended 2026-06-05** — the backend shipped every endpoint in **API Design**; [schema.yml](schema.yml) was updated and `src/client/` regenerated. The MSW mock layer is removed: **Phase 0b** (mock layer) and **Phase 39** (mock→live swap) are superseded, and every previously-mocked use-case now consumes the live generated op. See the **Amendments** section for the full change list.

Spec: [2026-06-05-INTEGRATE_WITH_PRIVATE_REST_API_SPEC.md](2026-06-05-INTEGRATE_WITH_PRIVATE_REST_API_SPEC.md).
This plan translates that spec into phased delivery; it does not re-derive requirements.
Read the spec's **Decisions → Use-cases** and **Decisions → State transitions & edge cases** alongside this plan.

## 1. Goals

1. Ship the application's full operational surface on top of the existing REST API: team/invitation management, calendar & event views, booking flows (single, recurring, group), recurring-scope edits, availability, calendar groups & bundles, external/rooms sync controls, admin event transfer, and REST-managed API tokens — every one of the spec's 38 use-cases usable by the correct role against the live API.
2. Render every screen with explicit loading / empty / error states and timezone-correct (DST-safe) times, per the spec's **Cross-cutting view states**.
3. Gate admin-only surfaces by organization role and route disabled users out of the app.
4. Build the shared infrastructure (app shell + routing, role gating, date/timezone utils, datatable, calendar) once, and reuse it across every use-case.

**Non-goals** (from spec **Negative scope** — restated so phases don't drift):

- Authentication / login UI, organization creation, invitation acceptance, the org-less gate — already implemented; untouched.
- Live/real-time calendar updates — sync is fire-and-toast with manual refresh; no websockets/polling.
- Webhook-health dashboards (subscription expiry / event-success-rate diagnostics).
- In-app optimistic-locking / conflict-merge UI — concurrent-edit collisions surface as backend errors.
- Billing/payments UI.
- A from-scratch calendar grid engine — a mature library is used.
- Notification-preference / email-template management.
- Backend/API changes — the backend has shipped every endpoint this plan needs; the frontend consumes the regenerated client directly and never invents a contract.
- Cross-organization / super-admin tooling.

## 2. Guiding Decisions

**Amended 2026-06-05**: the **Unfinished endpoints** decision (MSW mocking) is replaced by **Live endpoints** — all endpoints are generated and consumed directly; this affects every phase that previously read "**mocked**", plus Phases 0b and 39.

| Decision                                        | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Calendar library**                            | **react-big-calendar** with the **luxon** localizer. Most battle-tested; its month / week / agenda views map 1:1 to the spec's month / week / list. Custom event rendering carries the group-booking and availability overlays. BYO CSS themed to design tokens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Date / timezone stack**                       | **Luxon** everywhere. The spec requires each event to render in its own stored IANA zone with DST correctness and unambiguous mixed-zone lists; Luxon's explicit `DateTime`/zone model is the safest fit and also serves as the calendar localizer. Native `Date` + `toLocaleString` in [date-utils.ts](src/lib/utils/date-utils.ts) is replaced/extended by Luxon helpers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Datatables**                                  | **TanStack Table v8** behind one shared `DataTable` composition built on the shadcn [table](src/components/ui/) primitive + existing [pagination](src/components/ui/pagination.tsx). Server-driven search / filter / sort / pagination wired to the generated list operations. Reused by team, invitations, calendars, all-calendars, groups, bundles, tokens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **API tokens transport**                        | **REST**, via `/public-api-tokens/` (`GET` list, `POST` create → plaintext secret once, `PATCH {id}` replace grants, `POST {id}/revoke/`). **No GraphQL client** is introduced — REST already covers group availability, bookable slots, and computed windows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Live endpoints** (was "Unfinished endpoints") | **No mock layer.** The backend has shipped every endpoint and [schema.yml](schema.yml) is regenerated, so each data hook consumes its **real generated op** from [@/client](src/client/index.ts) directly. Confirmed live ops for the formerly-mocked surface: team list `organizationMembersList`; disable/reactivate user `organizationMembersDeactivateCreate` / `organizationMembersReactivateCreate`; revoke invite `invitationsDestroy`; calendar sync `calendarRequestSyncCreate`; admin sync another user's calendar `calendarAdminSyncCreate`; rooms-sync trigger `organizationsSyncRoomsCreate`; event transfer `calendarEventsTransferCreate`; bundle create/update `calendarBundleCreate` / `calendarBundlePartialUpdate`; API tokens `publicApiTokensList` / `publicApiTokensCreate` / `publicApiTokensPartialUpdate` / `publicApiTokensRevokeCreate`. Resend invitation = `invitationsResendCreate` (`POST /invitations/{id}/resend/`, regenerates token + refreshes expiry). One residual note: **rooms-sync config** has no dedicated config op → configuration persists via `organizationsPartialUpdate` on the org's rooms-sync fields (backend in progress; assume it works), with `organizationsSyncRoomsCreate` as the trigger. Tracked in **Open Questions**. |
| **Feature flag**                                | **None.** The operational surface is a purely additive new surface — new routes under a new app shell, new nav, new hooks — that does not change the shape of any existing auth/onboarding flow. Per the repo's planning rules, additive new surface skips the flag. **Role-based gating** (member vs admin) and the **disabled-user redirect** still apply and are tested.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Routing**                                     | A new `(app)` route group under [src/app/](src/app/) hosts every authenticated operational route behind the app shell + role gate; the existing `auth/` tree and root `page.tsx` are untouched.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Role / disabled gating**                      | Derived from [useCurrentOrganization](src/hooks/organizations/use-current-organization.ts)'s `CurrentMembership` (role) and the auth session. A disabled user hitting any `(app)` route is routed out (mirrors the existing org-less gate's degrade-don't-loop rule).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Booking conflict UX**                         | Warn-but-allow-override (spec **State transitions & edge cases**): never silent-proceed, never hard-block by default, never overwrite a conflicting event. A shared conflict-surface component is established with single booking and reused by recurring, group, and reschedule.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Recurring-edit scope prompt**                 | Every edit / cancel / reschedule on a recurrence-rule event opens a Google-Calendar-style scope dialog (This event / This and following / All events) before applying; non-recurring events skip it. The dialog is shared infra consumed by the three scope-edit phases and by cancel/reschedule.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Sync actions**                                | Fire-and-toast (`"sync started"`), no live tracking; the trigger control debounces/disables until the request returns (idempotency).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Token secret**                                | Shown once with copy-to-clipboard + a will-not-be-shown-again warning; never persisted in client state, never logged, cleared from memory when the creation dialog closes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

## 3. Data Model Changes

No database. "Data model" here = TypeScript types and generated-client types. **Amended 2026-06-05**: there are no mock contracts — the client is regenerated against the live schema and every op exists.

### 3.1 Generated client types (consumed, not authored)

All ops in [@/client](src/client/index.ts) are generated from the live [schema.yml](schema.yml). Reads/writes used across phases: `invitationsList/Create/Destroy/AcceptCreate`, `organizationMembersList/Deactivate/Reactivate`, `calendarList/Create/PartialUpdate/Destroy/RequestSyncCreate/AdminSyncCreate`, `calendarEventsList/Create/PartialUpdate/Destroy/BulkModifyCreate/CreateExceptionCreate/TransferCreate`, `calendarGroupsList/Create/AvailabilityCreate/BookableSlotsList/EventsCreate`, `calendarBundleCreate/PartialUpdate`, `calendarAvailableWindowsList/UnavailableWindowsList`, `availableTimes*`, `blockedTimes*`, `organizationsCurrentRetrieve/PartialUpdate/SyncRoomsCreate`, `publicApiTokensList/Create/PartialUpdate/RevokeCreate`, `profile*`. Phases consume these via domain hooks.

### 3.2 (Removed) Mock contracts

The MSW mock layer is gone (see the **Amendments** section). Hooks bind to the generated ops above directly; no `src/mocks/` directory is created.

### 3.3 Type plumbing

- `src/lib/datetime/` — Luxon helpers: `zonedFormat`, `eventRange`, `toApiRange`, `weekdayMatrix`, replacing/extending [date-utils.ts](src/lib/utils/date-utils.ts). A `RecurrenceRule` type (RFC-5545 subset: freq/interval/until/count/byday) for booking forms.
- `src/components/data-table/` — `DataTableColumn<T>`, `DataTableQuery` (page/size/sort/filter/search) types.
- `src/components/calendar/` — `CalendarEventVM` view-model (id, title, start/end as zoned `DateTime`, calendarId, timezone, recurrence?, status) mapping API events → react-big-calendar events.

## 4. API Design

**Amended 2026-06-05**: these endpoints are now **live and generated**; the table maps each to its real generated op (call signatures come from [@/client](src/client/index.ts), not from this plan). Where the backend named or shaped something differently than the original mock assumed, the real op below wins.

### 4.1 Team / invitations (live)

- Team list = `organizationMembersList` (`GET /organization-members/`) → paginated org members `{id, email, name, role, status}`.
- Resend invitation = `invitationsResendCreate` (`POST /invitations/{id}/resend/`) → regenerates token, re-sends, refreshes expiry.
- Revoke = `invitationsDestroy` (`DELETE /invitations/{id}/`).
- Disable user = `organizationMembersDeactivateCreate` (`POST /organization-members/{id}/deactivate/`); re-enable via `organizationMembersReactivateCreate`.

### 4.2 Calendars / sync (live)

- Disable calendar = `calendarPartialUpdate { is_active:false }`.
- Member calendar sync = `calendarRequestSyncCreate` (`POST /calendar/{id}/request-sync/`).
- Rooms sync: config persists via `organizationsPartialUpdate` on the org's rooms-sync fields; trigger = `organizationsSyncRoomsCreate` (`POST /organizations/{id}/sync-rooms/`). See **Open Questions** on the config split.
- Admin sync of another user's calendar = `calendarAdminSyncCreate` (`POST /calendar/{id}/admin-sync/`).

### 4.3 Bundles (live)

- Create = `calendarBundleCreate` (`POST /calendar/bundle/`).
- Update (children/primary/name) = `calendarBundlePartialUpdate` (`PATCH /calendar/{id}/bundle/`); disable via the same op with `is_active:false`.

### 4.4 Admin event control (live)

- Transfer = `calendarEventsTransferCreate` (`POST /calendar-events/{id}/transfer/ {destination_calendar_id}`) → moved event.

### 4.5 API tokens (live, REST)

- `publicApiTokensList` (`GET /public-api-tokens/`) → token metadata, no secret.
- `publicApiTokensCreate` (`POST /public-api-tokens/`) → meta + plaintext `token` shown once.
- `publicApiTokensPartialUpdate` (`PATCH /public-api-tokens/{id}/`) → updated meta, no secret.
- `publicApiTokensRevokeCreate` (`POST /public-api-tokens/{id}/revoke/`) → `is_active=false`.

## 5. Phased Rollout

Numbering: foundation = `Phase 0a–0f` (**Phase 0b superseded** — no mock layer); one use-case per numbered phase `Phase 1`–`Phase 38`; **Phase 39 superseded** — nothing to swap. No feature flag (additive surface), so no flag-removal phase. Every phase is independently mergeable and independently reversible; merging phase N while N+1 stalls leaves a working app (the route simply isn't linked yet).

**Amended 2026-06-05**: every phase consumes its **live generated op** directly (see **API Design**); there is no MSW step. Tests run against the generated client with per-test request stubbing where a unit test needs to isolate a hook (the repo's existing test approach), not a global mock worker.

---

### Phase 0a — App shell, routing & role gating

**Goal**: an authenticated `(app)` route group rendered inside the app shell (sidebar + topbar + page header), with member/admin gating and a disabled-user redirect. Ships value: navigable empty shell; individual feature routes light up in later phases.

**Feature flag**: none — additive new surface.

Changes:

1. Build `AppShell`, `AppSidebar`, `AppTopbar`, `PageHeader` in [src/components/navigation/](src/components/navigation/) per the responsive contracts already documented in [DESIGN.md](DESIGN.md) (`@container/app`, `@4xl` sidebar dock, mobile `Sheet`). Compose with layout primitives; class-based spacing on bars per DESIGN.md.
2. `src/app/(app)/layout.tsx`: server layout that bootstraps auth + reads [useCurrentOrganization](src/hooks/organizations/use-current-organization.ts); renders the shell, exposes role to a client `RoleGate` context.
3. `src/components/navigation/role-gate.tsx`: gates admin-only nav items + a route guard hook `useRequireRole('admin')` that redirects members out (degrade, don't loop).
4. Disabled-user handling: on `403`/disabled membership, route to a "no access" page, not back into `(app)`.
5. `src/app/(app)/page.tsx`: dashboard placeholder (links to feature areas as they ship).

Spec use-case: shared scaffolding — no use-case yet (enables the **Permission gating** cross-cutting rule).

Tests:

- **Unit**: `role-gate.test.tsx` — admin sees admin items, member doesn't; `useRequireRole` redirects a member.
- **Integration**: `(app)/layout.test.tsx` — onboarded member renders shell; disabled user is routed to no-access; org-less user still hits the existing gate.
- **E2E**: `e2e/tests/app/PR001-app-shell.spec.ts` — member logs in, lands in shell, sees member nav, admin-only links absent. Screenshots: shell desktop, shell mobile (drawer open), no-access page.

**Suggested AI model**: Tier 3 — `claude-sonnet-4-6`. Multi-file shell + responsive contracts + gating context across layout and nav.

**Reusable skills**: `Skill(new-composition)` (shell pieces), `Skill(new-page)` (route group + layout), `Skill(add-storybook-story)`.

Acceptance: a member can navigate the shell at `/` (app group) with role-correct nav; a disabled user is routed out; no existing auth route changes behavior.

---

### Phase 0b — ~~MSW mock layer~~ (**Superseded 2026-06-05**)

**Superseded** — the backend shipped every endpoint and [schema.yml](schema.yml) is regenerated, so there is no mock layer to build. No MSW dependency, no `src/mocks/`, no `NEXT_PUBLIC_API_MOCKING` flag, no `public/mockServiceWorker.js`. Feature phases bind directly to the generated ops listed in **API Design**. This phase is skipped by [implement-plan](.claude/skills/implement-plan/SKILL.md); its id is retired (not reused). Any later reference to "the mock layer" or "Phase 0b" should be read as "the live generated client".

---

### Phase 0c — Luxon date & timezone utilities

**Goal**: a tested Luxon helper layer for zone-aware formatting, range building, and weekly patterns, so every view renders events in their stored zone with DST correctness. Ships value: none on its own.

**Feature flag**: none — scaffolding.

Changes:

1. Add `luxon` + `@types/luxon`. `src/lib/datetime/index.ts`: `zonedFormat(iso, zone, fmt)`, `eventRange(view, anchor, zone)`, `toApiRange(range)` (timezone-correct query params), `weekdayMatrix()`, DST-boundary helpers.
2. Migrate [date-utils.ts](src/lib/utils/date-utils.ts) formatters to Luxon (keep signatures; re-export for callers).
3. A `RecurrenceRule` type + `serializeRRule`/`parseRRule` (RFC-5545 subset) for booking forms.

Spec use-case: shared scaffolding — no use-case yet (enables **Timezone** cross-cutting rule).

Tests:

- **Unit**: `src/lib/datetime/index.test.ts` — explicit **timezone matrix**: a DST spring-forward + fall-back boundary, two events in different zones formatted unambiguously, `toApiRange` round-trip, `serializeRRule`/`parseRRule` round-trip.

**Suggested AI model**: Tier 3 — `claude-sonnet-4-6`. Timezone/DST correctness is error-prone; warrants the stronger tier.

**Reusable skills**: none.

Acceptance: the timezone matrix test passes including DST boundaries; existing `date-utils` callers compile unchanged.

---

### Phase 0d — Shared DataTable composition

**Goal**: one reusable `DataTable` (TanStack Table v8 + shadcn primitives) with server-driven search / filter / sort / pagination, plus loading & empty states. Ships value: none on its own — every datatable consumes it.

**Feature flag**: none — scaffolding.

Changes:

1. Add `@tanstack/react-table`. `src/components/data-table/data-table.tsx` + `data-table-toolbar.tsx` (search/filter) + `data-table-pagination.tsx` (wraps [pagination.tsx](src/components/ui/pagination.tsx)).
2. `DataTableQuery` state hook syncing to URL search params; maps to generated list-op query args (page, page_size, ordering, search).
3. Skeleton loading rows via [skeleton](src/components/ui/skeleton.tsx); explicit empty-state slot.

Spec use-case: shared scaffolding — no use-case yet (enables **Datatables** cross-cutting rule).

Tests:

- **Unit**: `data-table.test.tsx` — renders rows; sort click updates query; search debounces; empty + loading states render.

**Suggested AI model**: Tier 3 — `claude-sonnet-4-6`. Generic table generics + URL-synced query state across files.

**Reusable skills**: `Skill(new-composition)`, `Skill(add-storybook-story)`.

Acceptance: a Storybook story drives the `DataTable` through loading → populated → empty with working sort/search/pagination against a fixture.

---

### Phase 0e — Calendar infrastructure (list / month / week)

**Goal**: a tokenized react-big-calendar wrapper exposing list, month, and week views over a shared `CalendarEventVM`, with a calendar-scope picker scaffold. Ships value: none on its own — event/booking phases consume it.

**Feature flag**: none — scaffolding.

Changes:

1. Add `react-big-calendar` (+ types). `src/components/calendar/calendar-view.tsx` with `luxonLocalizer`; theme its CSS to design tokens (no raw hex — DESIGN.md). Views: `agenda` (list), `month`, `week`.
2. `event-vm.ts`: map API `CalendarEvent` → `CalendarEventVM` (zoned start/end, per-event timezone label).
3. `calendar-scope-picker.tsx`: select a single calendar (scaffold; wired in Phase 15).
4. Custom event renderer hook point for later group/availability overlays.

Spec use-case: shared scaffolding — no use-case yet.

Tests:

- **Unit**: `calendar-view.test.tsx` — month/week/agenda each render the same fixture events; per-event timezone label correct; view switch preserves range.

**Suggested AI model**: Tier 3 — `claude-sonnet-4-6`. Library integration + zoned mapping + token theming.

**Reusable skills**: `Skill(new-composition)`, `Skill(add-storybook-story)`.

Acceptance: a Storybook story renders the same fixture across list/month/week with timezone-correct times and a (non-wired) scope picker.

---

### Phase 0f — E2E harness & QA use-cases doc

**Goal**: Playwright wired with a page-object base, screenshot convention, and a bootstrapped `QA_USE_CASES.md` so every UI phase can ship a happy-path e2e test. Ships value: none on its own.

**Feature flag**: none — scaffolding.

Changes:

1. Add `@playwright/test`; `playwright.config.ts` (baseURL → dev server pointed at the live API via `NEXT_PUBLIC_API_BASE_URL`), `e2e/` dir, page-object base, auth-bypass fixture (seed a member + an admin session against the live backend / a seeded test org).
2. Bootstrap [QA_USE_CASES.md](QA_USE_CASES.md) from this plan + spec via the `create-qa-use-cases` skill: enumerate `PR###` (member) / `PA###` (admin) ids for the 38 use-cases.
3. Screenshot convention: specs write via `testInfo.outputPath('<id>-<NN>-<slug>.png')`; a post-run copy step moves `test-results/**` matches into the gitignored `pr-screenshots/`.

Spec use-case: shared scaffolding — no use-case yet.

Tests:

- **E2E**: `e2e/tests/app/PR000-smoke.spec.ts` — dev server boots against the live API, member session loads the shell. Proves the harness + screenshot copy step work.

**Suggested AI model**: Tier 2 — `claude-haiku-4-5` (step up if auth fixture is fiddly). Config + scaffolding.

**Reusable skills**: `Skill(create-qa-use-cases)` then `Skill(add-e2e-test)` for the smoke spec.

Acceptance: `npx playwright test` runs the smoke spec green against the live-API app; `QA_USE_CASES.md` lists all 38 ids; screenshots land in `pr-screenshots/`.

---

> **Use-case phases (1–38).** Each adds its domain hook(s) under [src/hooks/](src/hooks/) (bound to the live generated op), its composition under `src/components/<feature>/`, its route under `src/app/(app)/`, unit + integration tests (including a **gating** test where admin-only), and a happy-path **E2E** with screenshots. None carry a feature flag (additive surface). Models default to Tier 2 unless the use-case carries real logic. Skills: `new-hook`, `new-composition`/`new-page`, `add-storybook-story`, `add-e2e-test`, plus `write-tests` where present.

#### Team & invitations (admin)

### Phase 1 — List team

**Goal**: admin views the org team in a searchable, paginated, sortable datatable.
Changes: `useTeamMembers` hook (`organizationMembersList`); `src/components/team/team-table.tsx` on `DataTable`; route `src/app/(app)/team/page.tsx` (admin-gated); link in admin nav.
Spec use-case: Use-cases **List team (admin)**.
Tests: Integration `team-table.test.tsx` (rows, search, pagination; member is gated out). E2E `PA001-team-list.spec.ts` (admin sees team; screenshots: populated, empty, loading).
**Suggested AI model**: Tier 2.
Acceptance: admin sees members with role + status; a member can't reach `/team`.

### Phase 2 — List pending invitations

**Goal**: admin views pending invitations (email, expiry, status) in a tab beside Team.
Changes: `useInvitations` (`invitationsList`, filter pending); `invitations-table.tsx`; `team/invitations` tab via [tabs](src/components/ui/tabs.tsx).
Spec use-case: Use-cases **List pending invitations (admin)**.
Tests: Integration (pending-only rows; empty state). E2E `PA002-invitations-list.spec.ts` (screenshots: list, empty).
**Suggested AI model**: Tier 2.
Acceptance: pending invitations render with expiry; non-pending excluded; admin-gated.

### Phase 3 — Invite a member

**Goal**: admin invites a new member by email + role, with duplicate-email idempotency.
Changes: `useCreateInvitation` (`invitationsCreate`, invalidates invitations key); invite dialog ([dialog](src/components/ui/dialog.tsx) + rhf/zod); on existing pending email, surface it + offer Resend instead of creating a duplicate (spec **Idempotency**).
Spec use-case: Use-cases **Invite a member (admin)**.
Tests: Integration (create → new pending row; duplicate email → surfaces existing + Resend, no second create). E2E `PA003-invite-member.spec.ts` (screenshots: dialog, new row, duplicate warning).
**Suggested AI model**: Tier 2.
Acceptance: a new pending invitation appears; inviting a duplicate does not create a second one (Acceptance scenario 3).

### Phase 4 — Resend an invitation

**Goal**: admin resends a pending invitation; expiry refreshes with a confirmation toast.
Changes: `useResendInvitation` (`invitationsResendCreate` — `POST /invitations/{id}/resend/`, regenerates the token and re-sends the pending invitation, refreshing expiry); Resend action on the invitations row; [sonner](src/components/ui/sonner.tsx) toast; control debounces; invalidates the invitations key on success.
Spec use-case: Use-cases **Resend an invitation (admin)**.
Tests: Integration (resend → toast, refreshed expiry; double-click debounced). E2E `PA004-resend-invite.spec.ts` (screenshots: row action, toast).
**Suggested AI model**: Tier 2.
Acceptance: resend fires once per click, shows the toast, refreshes expiry.

### Phase 5 — Revoke an invitation

**Goal**: admin revokes a pending invitation after confirm; the row leaves the list.
Changes: `useRevokeInvitation` (`invitationsDestroy` — `DELETE /invitations/{id}/` cancels the pending invite); [alert-dialog](src/components/ui/alert-dialog.tsx) confirm; invalidate invitations key.
Spec use-case: Use-cases **Revoke an invitation (admin)**.
Tests: Integration (confirm → row removed; cancel → no-op). E2E `PA005-revoke-invite.spec.ts` (screenshots: confirm, list after).
**Suggested AI model**: Tier 2.
Acceptance: a revoked invitation disappears from the pending list.

### Phase 6 — Disable a user

**Goal**: admin disables a member; the member loses app access and the row shows disabled.
Changes: `useDisableUser` (`organizationMembersDeactivateCreate` — `POST /organization-members/{id}/deactivate/`; re-enable counterpart `organizationMembersReactivateCreate`); confirm dialog; invalidate team key; relies on Phase 0a disabled-user redirect for access denial.
Spec use-case: Use-cases **Disable a user (admin)**.
Tests: Integration (disable → row disabled; disabled session routed to no-access). E2E `PA006-disable-user.spec.ts` (screenshots: confirm, disabled row, no-access on next request).
**Suggested AI model**: Tier 2.
Acceptance: a disabled member is denied access on next request and appears disabled (Acceptance scenario 7).

#### Calendars

### Phase 7 — List my calendars

**Goal**: member views their calendars (type, provider, sync state, active/disabled) in a datatable.
Changes: `useMyCalendars` (`calendarList`, scoped to caller); `calendars-table.tsx`; route `src/app/(app)/calendars/page.tsx`.
Spec use-case: Use-cases **List my calendars (member)**.
Tests: Integration (rows, filters; empty state). E2E `PR007-list-calendars.spec.ts` (screenshots: list, empty).
**Suggested AI model**: Tier 2.
Acceptance: member sees their calendars with type/provider/sync/status.

### Phase 8 — Create a calendar

**Goal**: member creates a personal calendar; it appears in the list and pickers.
Changes: `useCreateCalendar` (`calendarCreate`, invalidate calendars key); create dialog (rhf/zod: name/type/options).
Spec use-case: Use-cases **Create a calendar (member)**.
Tests: Integration (create → appears in list). E2E `PR008-create-calendar.spec.ts` (screenshots: dialog, new row).
**Suggested AI model**: Tier 2.
Acceptance: a created calendar round-trips and appears in active pickers.

### Phase 9 — Delete a calendar (**amended 2026-06-05**)

> **Amended 2026-06-05**: the original "Disable a calendar (keep it listed as disabled)" cannot be built — the API exposes `is_active` as **read-only** (it is not on `CalendarWritable`/`PatchedCalendarWritable`) and there is no calendar disable/deactivate endpoint, only `calendarDestroy` (hard DELETE). Per the user's decision, this phase is re-scoped to **Delete a calendar**: the calendar is removed entirely (not kept as a disabled row). Resolves Open Question #1 "disable-calendar field".

**Goal**: member deletes one of their calendars after confirm; it is removed from the list and from active pickers.
Changes: `useDeleteCalendar` (`calendarDestroy` — `DELETE /calendar/{id}/`); destructive `AlertDialog` confirm; invalidate `MY_CALENDARS_QUERY_KEY` (predicate form) so the list + pickers refetch. A **Delete** row action on the calendars table.
Spec use-case: Use-cases **Disable a calendar (member)** — re-scoped to delete.
Tests: Integration (confirm → `calendarDestroy` called once + row removed after invalidation; cancel → no call).
**Suggested AI model**: Tier 2.
Acceptance: a deleted calendar is removed from the list and stops appearing in active pickers.

### Phase 10 — Request a calendar to sync

**Goal**: member triggers a calendar sync; fire-and-toast, no live tracking.
Changes: `useRequestCalendarSync` (`calendarRequestSyncCreate` — `POST /calendar/{id}/request-sync/`); Sync action; toast `"sync started"`; control debounces (spec **Idempotency**).
Spec use-case: Use-cases **Request a calendar to sync (member)**.
Tests: Integration (trigger → toast; double-click debounced). E2E `PR010-request-sync.spec.ts` (screenshots: action, toast).
**Suggested AI model**: Tier 2.
Acceptance: sync fires once and confirms via toast.

### Phase 11 — List all calendars (incl. resources & bundles)

**Goal**: admin views every org calendar — personal, resource, virtual, bundle — filterable by type.
Changes: `useAllCalendars` (`calendarList`, org-wide admin scope); `all-calendars-table.tsx` with type badges ([badge](src/components/ui/badge.tsx)); route `(app)/all-calendars` (admin-gated).
Spec use-case: Use-cases **List all calendars incl. resources & bundles (admin)**.
Tests: Integration (type filter distinguishes 4 kinds; member gated). E2E `PA011-all-calendars.spec.ts` (screenshots: all types, filtered).
**Suggested AI model**: Tier 2.
Acceptance: the datatable distinguishes personal/resource/virtual/bundle and filters by type.

#### Events

### Phase 12 — View events as a list

**Goal**: member views events in the visible range as a timezone-correct chronological list.
Changes: `useCalendarEvents` (`calendarEventsList`, `toApiRange`); agenda view via Phase 0e; route `src/app/(app)/events/page.tsx`.
Spec use-case: Use-cases **View events as a list (member)**.
Tests: Integration (chronological order; per-event zone correct). E2E `PR012-events-list.spec.ts` (screenshots: list, empty).
**Suggested AI model**: Tier 2.
Acceptance: events render chronologically, each in its own timezone.

### Phase 13 — View events as a month calendar

**Goal**: member switches to Month and sees the month grid with the same events.
Changes: month view toggle on `/events` using Phase 0e; range = month.
Spec use-case: Use-cases **View events as a month calendar (member)**.
Tests: Integration (month grid shows the list's events). E2E `PR013-events-month.spec.ts` (screenshot: month).
**Suggested AI model**: Tier 2.
Acceptance: month renders the same underlying events as list.

### Phase 14 — View events as a week calendar

**Goal**: member switches to Week and sees the week grid with the same events.
Changes: week view toggle; range = week.
Spec use-case: Use-cases **View events as a week calendar (member)**.
Tests: Integration (week grid parity with list/month). E2E `PR014-events-week.spec.ts` (screenshot: week).
**Suggested AI model**: Tier 2.
Acceptance: week renders the same events; view parity holds (Acceptance scenario 8).

### Phase 15 — View events for one specific calendar

**Goal**: selecting a single calendar in the scope picker refilters all three views.
Changes: wire Phase 0e `calendar-scope-picker` to `useMyCalendars`; scope state in URL; refilter list/month/week query.
Spec use-case: Use-cases **View events for one specific calendar (member)**.
Tests: Integration (scope change refilters all three views). E2E `PR015-scope-calendar.spec.ts` (screenshots: scoped list/month/week).
**Suggested AI model**: Tier 2.
Acceptance: scoping to one calendar refilters list, month, and week (Acceptance scenario 8).

#### Bookings

### Phase 16 — Single booking with co-booked calendars

**Goal**: member creates a single booking selecting additional calendars to co-book, with availability check + conflict-surface.
Changes: `useCreateBooking` (`calendarEventsCreate`); booking form (rhf/zod: date/time/title/attendees/co-booked calendars); availability check via `calendarAvailableWindowsList`/`UnavailableWindowsList`; **establish the shared conflict-surface component** (which calendar/why + nearest free, warn-but-allow-override, never overwrite — spec **Booking conflict handling**); submit disables on first click (spec **Idempotency**).
Spec use-case: Use-cases **Create a single booking with co-booked calendars (member)**.
Tests: Integration (event on primary + blocked-time on co-booked; conflict surfaced + override path; override rejected by backend → error, no event). E2E `PR016-single-booking.spec.ts` (screenshots: form, conflict warning, success + co-booked blocked-time).
**Suggested AI model**: Tier 3 — `claude-sonnet-4-6`. Co-booking side-effects + conflict UX + availability orchestration.
Acceptance: one event on the primary calendar + a blocked-time on each co-booked calendar (Acceptance scenario 1); conflict override behaves per scenario 4.

### Phase 17 — Recurring booking

**Goal**: member enables Repeat and creates an event with an RFC-5545-style recurrence rule.
Changes: recurrence sub-form (freq/interval/end via `RecurrenceRule` from Phase 0c) in the Phase 16 form; reuse conflict-surface.
Spec use-case: Use-cases **Create a recurring booking (member)**.
Tests: Integration (event carries the serialized rule; first/Nth occurrences render). E2E `PR017-recurring-booking.spec.ts` (screenshots: recurrence form, recurring series in week view).
**Suggested AI model**: Tier 3 — `claude-sonnet-4-6`. RRULE serialization + recurrence rendering.
Acceptance: a recurring event is created with its recurrence rule and renders across occurrences.

### Phase 18 — Book on a Calendar Group

**Goal**: member books a Calendar Group time, picking the required count of calendars per slot, validated against per-slot availability.
Changes: group booking flow on `calendarGroupsBookableSlotsList` (suggestions) + `calendarGroupsAvailabilityCreate` (per-slot availability) + `calendarGroupsEventsCreate`; per-slot picker enforces required counts; only free candidates selectable; unsatisfiable slot blocks submit; reuse conflict-surface.
Spec use-case: Use-cases **Book on a Calendar Group (member)**.
Tests: Integration (only-free candidates selectable; unsatisfiable slot prevents submit; success records which calendars satisfied which slot + blocked-times on others). E2E `PR018-group-booking.spec.ts` (screenshots: slot pickers, partial-availability state, success).
**Suggested AI model**: Tier 4 — `claude-opus-4-7`. Group-slot satisfiability + availability overlay is the spike-flagged risk.
Acceptance: per-slot selection enforces required counts and per-slot availability (Acceptance scenario 5).

### Phase 19 — Manage attendees on an event

**Goal**: member adds/removes internal attendees, external attendees, and resource allocations.
Changes: `useUpdateAttendees` (`calendarEventsPartialUpdate` attendance fields — confirm shape); attendee editor on the event detail.
Spec use-case: Use-cases **Manage attendees on an event (member)**.
Tests: Integration (add/remove internal/external/resource round-trips). E2E `PR019-manage-attendees.spec.ts` (screenshots: editor, updated list).
**Suggested AI model**: Tier 2.
Acceptance: attendance records update for all three attendee kinds.

### Phase 20 — Cancel a booking

**Goal**: member cancels an event after confirm; co-booked blocked-times release.
Changes: `useCancelBooking` (`calendarEventsDestroy` or cancel op — confirm); confirm dialog; **for recurring events, route through the Phase 22 scope prompt** (built here if Phase 22 not yet merged — see ordering note).
Spec use-case: Use-cases **Cancel a booking (member)**.
Tests: Integration (cancel → event gone + blocked-times released). E2E `PR020-cancel-booking.spec.ts` (screenshots: confirm, released co-booked slot).
**Suggested AI model**: Tier 2.
Acceptance: a cancelled event releases its co-booked blocked-times.

### Phase 21 — Reschedule a booking

**Goal**: member reschedules an event to a new time with an availability re-check; co-booked blocked-times move.
Changes: `useRescheduleBooking` (`calendarEventsPartialUpdate` time); re-run availability check + conflict-surface; recurring → scope prompt.
Spec use-case: Use-cases **Reschedule a booking (member)**.
Tests: Integration (move event + blocked-times; conflict re-checked). E2E `PR021-reschedule-booking.spec.ts` (screenshots: reschedule form, moved event).
**Suggested AI model**: Tier 2 (Tier 3 if conflict re-check proves fiddly).
Acceptance: the event and its co-booked blocked-times move to the new time.

#### Recurring-event scope edits

### Phase 22 — Adjust one instance

**Goal**: on a recurring occurrence, the scope prompt's "This event" records a single-occurrence exception. **Builds the shared scope-prompt dialog** (This event / This and following / All events) consumed by 23, 24, and recurring cancel/reschedule.
Changes: `scope-prompt-dialog.tsx`; `useEditOccurrence` (`calendarEventsCreateExceptionCreate`); wire into edit/cancel/reschedule entry points for recurring events; non-recurring skip the prompt.
Spec use-case: Use-cases **Adjust one instance (member)**.
Tests: Integration (recurring → prompt appears, "This event" → exception; non-recurring → no prompt). E2E `PR022-scope-this-event.spec.ts` (screenshots: prompt, single exception in series).
**Suggested AI model**: Tier 3 — `claude-sonnet-4-6`. Shared scope-routing infra + exception semantics.
Acceptance: a scope prompt appears on every recurring mutation; "This event" creates a single-occurrence exception.

### Phase 23 — Adjust this and following

**Goal**: "This and following" splits the series at the occurrence (truncate original + continuation with the change).
Changes: `useEditThisAndFollowing` (`calendarEventsBulkModifyCreate` / split op — confirm); wire into the Phase 22 prompt.
Spec use-case: Use-cases **Adjust this and following (member)**.
Tests: Integration (occurrence + later move; earlier unchanged). E2E `PR023-scope-following.spec.ts` (screenshots: prompt, split series in week view).
**Suggested AI model**: Tier 3 — `claude-sonnet-4-6`. Series-split semantics.
Acceptance: the chosen occurrence and all later ones change; earlier ones don't (Acceptance scenario 2).

### Phase 24 — Adjust all instances

**Goal**: "All events" edits the whole series.
Changes: `useEditWholeSeries` (`calendarEventsUpdate`/`PartialUpdate` on the series); wire into the prompt.
Spec use-case: Use-cases **Adjust all instances (member)**.
Tests: Integration (whole series reflects the edit). E2E `PR024-scope-all.spec.ts` (screenshots: prompt, whole-series change).
**Suggested AI model**: Tier 2.
Acceptance: "All events" edits the entire series.

#### Availability

### Phase 25 — Edit my availability

**Goal**: member edits available-time windows (weekly patterns + ad-hoc dates); computed availability reflects it.
Changes: `useAvailableTimes` (`availableTimesList` + `availableTimesBulkModifyCreate`/`BulkCreateCreate`); weekly-pattern + ad-hoc editor (uses `weekdayMatrix`); route `src/app/(app)/availability/page.tsx`.
Spec use-case: Use-cases **Edit my availability (member)**.
Tests: Integration (weekly + ad-hoc round-trip; computed reflects change). E2E `PR025-edit-availability.spec.ts` (screenshots: editor, saved state).
**Suggested AI model**: Tier 3 — `claude-sonnet-4-6`. Weekly-pattern + ad-hoc editor with bulk writes.
Acceptance: availability edits round-trip and recompute.

### Phase 26 — Create blocked times

**Goal**: member adds one-off or recurring blocked times; they show busy.
Changes: `useBlockedTimes` (`blockedTimesCreate`/`BulkCreateCreate`/`CreateExceptionCreate`); blocked-time form (one-off + recurrence) on the availability page.
Spec use-case: Use-cases **Create blocked times (member)**.
Tests: Integration (one-off + recurring blocked time → busy window). E2E `PR026-blocked-times.spec.ts` (screenshots: form, busy window).
**Suggested AI model**: Tier 2 (Tier 3 if recurrence reuse is non-trivial).
Acceptance: blocked times round-trip and render the member busy.

### Phase 27 — Check another user's availability

**Goal**: member views a colleague's free/busy over a date range without private event detail.
Changes: `useUserAvailability` (`calendarAvailableWindowsList`/`UnavailableWindowsList` for the target user — privacy per spec Open Q3 default: only what those ops return); colleague picker + range picker + free/busy view.
Spec use-case: Use-cases **Check another user's availability (member)**.
Tests: Integration (free/busy windows render; no private titles leak). E2E `PR027-check-availability.spec.ts` (screenshots: picker, free/busy).
**Suggested AI model**: Tier 2.
Acceptance: a colleague's free/busy is viewable without exposing private detail beyond the API.

#### Calendar Groups (admin)

### Phase 28 — List Calendar Groups

**Goal**: admin views the org's Calendar Groups in a datatable.
Changes: `useCalendarGroups` (`calendarGroupsList`); `groups-table.tsx`; route `(app)/groups` (admin-gated).
Spec use-case: Use-cases **List Calendar Groups (admin)**.
Tests: Integration (rows; member gated). E2E `PA028-groups-list.spec.ts` (screenshots: list, empty).
**Suggested AI model**: Tier 2.
Acceptance: admin sees the org's groups.

### Phase 29 — Create a Calendar Group

**Goal**: admin creates a group with named slots (required counts) + candidate calendar pools; it becomes bookable.
Changes: `useCreateCalendarGroup` (`calendarGroupsCreate`); group builder form (slots + per-slot pool + required count).
Spec use-case: Use-cases **Create a Calendar Group (admin)**.
Tests: Integration (create → bookable by a member, ties to Phase 18). E2E `PA029-create-group.spec.ts` (screenshots: builder, created group).
**Suggested AI model**: Tier 3 — `claude-sonnet-4-6`. Nested slot/pool form.
Acceptance: a created group round-trips and is immediately bookable.

#### Calendar Bundles (admin)

### Phase 30 — Create a bundle

**Goal**: admin creates a bundle (child calendars + one primary).
Changes: `useCreateBundle` (`calendarBundleCreate`); bundle form; route `(app)/bundles` (admin-gated).
Spec use-case: Use-cases **Create a bundle (admin)**.
Tests: Integration (create → appears in all-calendars as bundle). E2E `PA030-create-bundle.spec.ts` (screenshots: form, bundle row).
**Suggested AI model**: Tier 2.
Acceptance: bundle create round-trips.

### Phase 31 — Update a bundle

**Goal**: admin edits a bundle's children/primary/name.
Changes: `useUpdateBundle` (`calendarBundlePartialUpdate` — `PATCH /calendar/{id}/bundle/`); edit form.
Spec use-case: Use-cases **Update a bundle (admin)**.
Tests: Integration (update round-trips). E2E `PA031-update-bundle.spec.ts` (screenshots: edit, updated).
**Suggested AI model**: Tier 2.
Acceptance: bundle update round-trips.

### Phase 32 — Delete a bundle (**amended 2026-06-05**)

> **Amended 2026-06-05**: like Phase 9 (calendar disable), `is_active` is **read-only** — it is not on `CalendarBundleCreate`/`PatchedCalendarBundleUpdate`/`PatchedCalendarWritable`, and there is no bundle disable endpoint. Per the user's Phase-9 decision (hard DELETE for the same `is_active` gap), this phase is re-scoped to **Delete a bundle**: a bundle IS a calendar (`calendar_type: 'bundle'`), so it is removed via `calendarDestroy`.

**Goal**: admin deletes a bundle after confirm; it is removed from the list and from active pickers.
Changes: `useDeleteBundle` (`calendarDestroy` — `DELETE /calendar/{id}/`); destructive `AlertDialog` confirm; invalidate the calendars/bundle list (predicate). A **Delete** row action on the bundles table (beside Edit).
Spec use-case: Use-cases **Disable a bundle (admin)** — re-scoped to delete.
Tests: Integration (confirm → `calendarDestroy` called once + row removed; cancel → no-op).
**Suggested AI model**: Tier 2.
Acceptance: a deleted bundle is removed from the list and stops appearing in active pickers.

#### Sync & rooms (admin)

### Phase 33 — Configure rooms sync

**Goal**: admin enables/configures rooms (resource) sync for the org.
Changes: `useRoomsSyncConfig` (no dedicated config op — persist rooms-sync settings via `organizationsPartialUpdate` on the org, read via `organizationsCurrentRetrieve`; see **Open Questions**); Sync Settings form; route `(app)/sync-settings` (admin-gated).
Spec use-case: Use-cases **Configure rooms sync (admin)**.
Tests: Integration (config saves + reloads). E2E `PA033-rooms-sync-config.spec.ts` (screenshots: form, saved).
**Suggested AI model**: Tier 2.
Acceptance: rooms-sync configuration saves.

### Phase 34 — Trigger a rooms sync

**Goal**: admin triggers a rooms sync; fire-and-toast.
Changes: `useTriggerRoomsSync` (`organizationsSyncRoomsCreate` — `POST /organizations/{id}/sync-rooms/`); Sync Rooms button; toast; debounce.
Spec use-case: Use-cases **Trigger a rooms sync (admin)**.
Tests: Integration (trigger → toast; debounced). E2E `PA034-trigger-rooms-sync.spec.ts` (screenshots: button, toast).
**Suggested AI model**: Tier 2.
Acceptance: rooms sync fires once and confirms via toast.

### Phase 35 — Manually sync another user's calendar

**Goal**: admin triggers a sync of another user's calendar; fire-and-toast.
Changes: `useTriggerUserCalendarSync` (`calendarAdminSyncCreate` — `POST /calendar/{id}/admin-sync/`, admin-scoped); Sync action on all-calendars rows; toast; debounce.
Spec use-case: Use-cases **Manually sync another user's calendar (admin)**.
Tests: Integration (trigger → toast; member gated). E2E `PA035-sync-user-calendar.spec.ts` (screenshots: action, toast).
**Suggested AI model**: Tier 2.
Acceptance: an admin can fire another user's calendar sync with a toast.

#### Admin event control

### Phase 36 — Transfer an event between users' calendars

**Goal**: admin transfers an event to another user's calendar; both sides reflect it.
Changes: `useTransferEvent` (`calendarEventsTransferCreate` — `POST /calendar-events/{id}/transfer/ {destination_calendar_id}`); Transfer dialog (destination picker) on event detail; confirm.
Spec use-case: Use-cases **Transfer an event between users' calendars (admin)**.
Tests: Integration (transfer → source loses, destination gains; member gated). E2E `PA036-transfer-event.spec.ts` (screenshots: transfer dialog, both calendars after).
**Suggested AI model**: Tier 2.
Acceptance: the event moves; source and destination reflect the move.

#### API tokens (admin)

### Phase 37 — Generate an API token with permissions

**Goal**: admin generates a scoped token; the secret is shown once with copy + a never-again warning.
Changes: `usePublicApiTokens` + `useCreatePublicApiToken` (`publicApiTokensList` / `publicApiTokensCreate`); tokens table + New Token dialog (name + scope selection — scopes = whatever the create API accepts, spec Open Q2 default); show-once secret with copy-to-clipboard, cleared from memory on close, never logged/refetched; route `(app)/api-tokens` (admin-gated).
Spec use-case: Use-cases **Generate an API token with permissions (admin)**.
Tests: Integration (create → secret shown once, not re-rendered after close, not in refetched list). E2E `PA037-generate-token.spec.ts` (screenshots: dialog, secret-once + warning, token row without secret).
**Suggested AI model**: Tier 3 — `claude-sonnet-4-6`. Show-once secret handling + scope model + no-persistence guarantees.
Acceptance: a generated token's secret shows once with copy + warning and is never re-displayed (Acceptance scenario 6).

### Phase 38 — Invalidate an API token

**Goal**: admin invalidates a token after confirm; it's marked invalidated and rejected on later calls.
Changes: `useRevokePublicApiToken` (`publicApiTokensRevokeCreate` — `POST /public-api-tokens/{id}/revoke/`); confirm dialog; row marks invalidated.
Spec use-case: Use-cases **Invalidate an API token (admin)**.
Tests: Integration (revoke → row invalidated; secret never re-shown). E2E `PA038-invalidate-token.spec.ts` (screenshots: confirm, invalidated row).
**Suggested AI model**: Tier 2.
Acceptance: an invalidated token is marked invalidated and the secret is never re-displayed (Acceptance scenario 6).

---

### Phase 39 — ~~Replace MSW mocks with the regenerated client~~ (**Superseded 2026-06-05**)

**Superseded** — there is no mock layer to swap. The backend shipped every endpoint, [schema.yml](schema.yml) was regenerated up front, and every feature phase binds to its live generated op from the start. The one-time client regeneration (`npm run openapi-ts`) that this phase would have run has already happened as part of the 2026-06-05 amendment. This phase is skipped by [implement-plan](.claude/skills/implement-plan/SKILL.md); its id is retired. If the backend later changes a shape, re-run `npm run openapi-ts` and fix the affected hook directly — no dedicated swap phase is needed.

## 6. Risk & Rollout Notes

- **No feature flag** — additive surface. Rollout is "merge the phase, link the route." Each phase is independently reversible (revert its PR; the route delinks).
- **No mock→live swap** (Phase 39 superseded). The backend has shipped every endpoint and the client is regenerated, so there is no ordering dependency on backend delivery. If a backend shape changes after a hook is built, re-run `npm run openapi-ts` and reconcile that hook directly (frontend never invents — it reconciles to the delivered schema).
- **Calendar-library risk** (spec Risk 2): Phase 0e + Phase 18 carry the group-booking/availability-overlay spike. If react-big-calendar can't render the overlay cleanly, escalate Phase 18 before committing downstream group work.
- **Timezone/DST** (spec Risk 4): the Phase 0c timezone matrix test (DST boundaries + mixed-zone) is the guardrail; every view phase asserts per-event-zone rendering.
- **Token secret** (spec Risk 6): Phase 37 asserts the secret is never persisted, refetched, or logged, and is cleared on dialog close.
- **No DB / migrations / locks / partitions / backfills** — this is a frontend integration; none apply.
- **Rollback**: per-phase PR revert. No data migration to unwind.

## 7. Open Questions

Carried from the spec (frontend invents nothing — these resolve via backend/product before or during Phase 39):

1. **API coverage gaps** — ✅ **Resolved 2026-06-05.** Every path is live in [schema.yml](schema.yml); the **API Design** table lists the real generated ops, including `invitationsResendCreate` for resend. One residual semantic confirmation remains (build proceeds on the stated default):
   - **Rooms-sync config** — no dedicated config op; default is persist config via `organizationsPartialUpdate` (rooms-sync fields on the org; backend in progress, assume it works), trigger via `organizationsSyncRoomsCreate`. **Owner**: backend lead — confirm the org carries the rooms-sync config fields.
2. **Token scope granularity** — what scopes `POST /public-api-tokens/` accepts. **Default**: expose whatever the create API accepts; **owner**: backend lead.
3. **"Check another user's availability" privacy** — free/busy only vs titles. **Default**: show only what the windows ops return (no private titles); **owner**: product.
4. **Conflict override rules** — which conflict types a member may override. **Default**: allow override only where the backend write succeeds; surface rejection otherwise; **owner**: product + backend.
5. **Co-booked calendars vs Group/Bundle** — ad-hoc co-booking vs routing through a mechanism. **Default**: ad-hoc co-booking (event on primary + blocked-times on others), per Phase 16; **owner**: product.

## 8. Touch List

Grouped by phase. `@path` = new file; `[name](path)` = edited.

- **Phase 0a**: `@src/app/(app)/layout.tsx`, `@src/app/(app)/page.tsx`, `@src/components/navigation/app-shell.tsx`, `@src/components/navigation/app-sidebar.tsx`, `@src/components/navigation/app-topbar.tsx`, `@src/components/navigation/page-header.tsx`, `@src/components/navigation/role-gate.tsx`; consumes [use-current-organization.ts](src/hooks/organizations/use-current-organization.ts).
- **Phase 0b**: ~~MSW mock layer~~ **superseded 2026-06-05** — no files; client regenerated from [schema.yml](schema.yml) into `src/client/` instead.
- **Phase 0c**: `@src/lib/datetime/index.ts`; edits [date-utils.ts](src/lib/utils/date-utils.ts), [package.json](package.json).
- **Phase 0d**: `@src/components/data-table/*`; consumes [pagination.tsx](src/components/ui/pagination.tsx), [skeleton.tsx](src/components/ui/skeleton.tsx); edits [package.json](package.json).
- **Phase 0e**: `@src/components/calendar/*`; edits [package.json](package.json).
- **Phase 0f**: `@playwright.config.ts`, `@e2e/**`, `@QA_USE_CASES.md`; edits [package.json](package.json), `.gitignore` (`pr-screenshots/`).
- **Phases 1–6** (team/invitations): `@src/hooks/team/*`, `@src/hooks/invitations/*`, `@src/components/team/*`, `@src/app/(app)/team/**`, `@e2e/tests/app/PA00{1..6}-*.spec.ts`.
- **Phases 7–11** (calendars): `@src/hooks/calendars/*`, `@src/components/calendars/*`, `@src/app/(app)/calendars/**`, `@src/app/(app)/all-calendars/**`, `@e2e/tests/app/P{R007,R008,R009,R010,A011}-*.spec.ts`.
- **Phases 12–15** (events): `@src/hooks/events/*`, `@src/components/events/*`, `@src/app/(app)/events/**`, `@e2e/tests/app/PR01{2..5}-*.spec.ts`.
- **Phases 16–21** (bookings): `@src/hooks/bookings/*`, `@src/components/bookings/*` (incl. shared `conflict-surface.tsx`), `@e2e/tests/app/PR0{16..21}-*.spec.ts`.
- **Phases 22–24** (scope edits): `@src/components/bookings/scope-prompt-dialog.tsx`, `@src/hooks/bookings/use-edit-*`, `@e2e/tests/app/PR02{2..4}-*.spec.ts`.
- **Phases 25–27** (availability): `@src/hooks/availability/*`, `@src/components/availability/*`, `@src/app/(app)/availability/**`, `@e2e/tests/app/PR02{5..7}-*.spec.ts`.
- **Phases 28–29** (groups): `@src/hooks/calendar-groups/*`, `@src/components/calendar-groups/*`, `@src/app/(app)/groups/**`, `@e2e/tests/app/PA02{8,9}-*.spec.ts`.
- **Phases 30–32** (bundles): `@src/hooks/bundles/*`, `@src/components/bundles/*`, `@src/app/(app)/bundles/**`, `@e2e/tests/app/PA03{0..2}-*.spec.ts`.
- **Phases 33–35** (sync): `@src/hooks/sync/*`, `@src/components/sync/*`, `@src/app/(app)/sync-settings/**`, `@e2e/tests/app/PA03{3..5}-*.spec.ts`.
- **Phase 36** (transfer): `@src/hooks/events/use-transfer-event.ts`, `@src/components/events/transfer-dialog.tsx`, `@e2e/tests/app/PA036-*.spec.ts`.
- **Phases 37–38** (tokens): `@src/hooks/api-tokens/*`, `@src/components/api-tokens/*`, `@src/app/(app)/api-tokens/**`, `@e2e/tests/app/PA03{7,8}-*.spec.ts`.
- **Phase 39** (swap): ~~delete mocks + import swaps~~ **superseded 2026-06-05** — the one-time [schema.yml](schema.yml) regen into `src/client/` already happened during the amendment; no swap work remains.

## 9. Amendments

- **2026-06-05** — Backend shipped every endpoint in **API Design**; [schema.yml](schema.yml) updated and `src/client/` regenerated (`npm run openapi-ts`). Dropped the MSW mock layer entirely: **Phase 0b** (mock layer) and **Phase 39** (mock→live swap) superseded; the **Guiding Decisions** "Unfinished endpoints" row became **Live endpoints**; **Data Model Changes** mock-contracts subsection removed; **API Design** retitled to map each formerly-mocked path to its real generated op; every use-case phase (1, 4, 5, 6, 10, 31, 32, 33, 34, 35, 36, 37, 38) repointed from a `**mocked**` path to its live op; **Phase 0f** e2e harness repointed from `NEXT_PUBLIC_API_MOCKING` to the live API via `NEXT_PUBLIC_API_BASE_URL`; **Open Questions #1** marked resolved; resend-invite uses the live `invitationsResendCreate` op (added after the first amendment pass), leaving one residual semantic confirmation (rooms-sync config via `organizationsPartialUpdate`). No phase branches existed yet, so no force-push was needed. Affected phases: 0b, 0f, 1, 4, 5, 6, 10, 31, 32, 33, 34, 35, 36, 37, 38, 39. Branches force-pushed: none (plan not yet started).
- **2026-06-05 (during Phase 9)** — **Phase 9 re-scoped from "Disable a calendar" to "Delete a calendar"** (user decision). The live API exposes `Calendar.is_active` as read-only (absent from `CalendarWritable`/`PatchedCalendarWritable`) and has no calendar disable/deactivate endpoint — only `calendarDestroy` (hard DELETE). Phase 9 now deletes the calendar via `calendarDestroy`; the "stays listed as disabled" acceptance is replaced by "removed from list + pickers". This is forward-only (Phase 9 not yet implemented at amendment time) — no branch rewrite.

- **2026-06-05 (during Phase 32)** — **Phase 32 re-scoped from "Disable a bundle" to "Delete a bundle"**, applying the same Phase-9 decision: `is_active` is read-only (absent from all bundle/calendar writables) and there's no disable endpoint, so a bundle (a `calendar_type:'bundle'` calendar) is removed via `calendarDestroy`. Forward-only (Phase 32 not yet implemented).
