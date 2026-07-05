# QA Use-Cases Index

Durable index of every end-to-end test case for the Vinta Schedule operational
surface. IDs are stable — never renumbered. Each phase appends its e2e spec
path when shipped.

**Prefix key:**

- `PR###` — **member** (regular) use-case
- `PA###` — **admin**-only use-case

---

## Foundation (Phase 0f)

| ID    | Role   | Happy-path description                                                              | Spec path                           |
| ----- | ------ | ----------------------------------------------------------------------------------- | ----------------------------------- |
| PR000 | member | Dev server boots and a member session loads the (app) shell with member nav visible | `e2e/tests/app/PR000-smoke.spec.ts` |

---

## Team & Invitations (Phases 1–6)

| ID    | Role  | Happy-path description                                                                | Spec path                                      |
| ----- | ----- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| PA001 | admin | Admin views the org team in a searchable, paginated, sortable datatable               | `e2e/tests/app/PA001-team-list.spec.ts`        |
| PA002 | admin | Admin views pending invitations (email, expiry, status) in a datatable tab            | `e2e/tests/app/PA002-invitations-list.spec.ts` |
| PA003 | admin | Admin invites a new member by email and role; a pending row appears                   | `e2e/tests/app/PA003-invite-member.spec.ts`    |
| PA004 | admin | Admin resends a pending invitation; expiry refreshes and a toast confirms             | `e2e/tests/app/PA004-resend-invite.spec.ts`    |
| PA005 | admin | Admin revokes a pending invitation after confirming; the row leaves the list          | `e2e/tests/app/PA005-revoke-invite.spec.ts`    |
| PA006 | admin | Admin disables a member after confirming; the member is denied access on next request | `e2e/tests/app/PA006-disable-user.spec.ts`     |

---

## Calendars (Phases 7–11)

| ID    | Role   | Happy-path description                                                                    | Spec path                                      |
| ----- | ------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------- |
| PR007 | member | Member views their calendars (type, provider, sync state, active/disabled) in a datatable | `e2e/tests/app/PR007-list-calendars.spec.ts`   |
| PR008 | member | Member creates a personal calendar; it appears in the list and pickers                    | `e2e/tests/app/PR008-create-calendar.spec.ts`  |
| PR009 | member | Member disables one of their calendars; it stops appearing in active pickers              | `e2e/tests/app/PR009-disable-calendar.spec.ts` |
| PR010 | member | Member triggers a calendar sync; a toast confirms "sync started"                          | `e2e/tests/app/PR010-request-sync.spec.ts`     |
| PA011 | admin  | Admin views all org calendars (personal, resource, virtual, bundle) filterable by type    | `e2e/tests/app/PA011-all-calendars.spec.ts`    |

---

## Events (Phases 12–15)

| ID    | Role   | Happy-path description                                                            | Spec path                                    |
| ----- | ------ | --------------------------------------------------------------------------------- | -------------------------------------------- |
| PR012 | member | Member views events in the visible range as a timezone-correct chronological list | `e2e/tests/app/PR012-events-list.spec.ts`    |
| PR013 | member | Member switches to Month and sees the month grid with the same events             | `e2e/tests/app/PR013-events-month.spec.ts`   |
| PR014 | member | Member switches to Week and sees the week grid with the same events               | `e2e/tests/app/PR014-events-week.spec.ts`    |
| PR015 | member | Member selects a single calendar in the scope picker; all three views refilter    | `e2e/tests/app/PR015-scope-calendar.spec.ts` |

---

## Bookings (Phases 16–21)

| ID    | Role   | Happy-path description                                                                                 | Spec path                                        |
| ----- | ------ | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| PR016 | member | Member creates a single booking with co-booked calendars; event and blocked-times appear               | `e2e/tests/app/PR016-single-booking.spec.ts`     |
| PR017 | member | Member creates a recurring booking with an RFC-5545 recurrence rule; series renders across occurrences | `e2e/tests/app/PR017-recurring-booking.spec.ts`  |
| PR018 | member | Member books a Calendar Group time, selecting calendars per slot; event and blocked-times appear       | `e2e/tests/app/PR018-group-booking.spec.ts`      |
| PR019 | member | Member adds and removes internal, external, and resource attendees on an event                         | `e2e/tests/app/PR019-manage-attendees.spec.ts`   |
| PR020 | member | Member cancels a booking after confirming; the event and its co-booked blocked-times are released      | `e2e/tests/app/PR020-cancel-booking.spec.ts`     |
| PR021 | member | Member reschedules a booking to a new time; event and co-booked blocked-times move                     | `e2e/tests/app/PR021-reschedule-booking.spec.ts` |

---

## Recurring-event scope edits (Phases 22–24)

| ID    | Role   | Happy-path description                                                                                               | Spec path                                      |
| ----- | ------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| PR022 | member | On a recurring occurrence, member picks "This event" from the scope prompt; a single-occurrence exception is created | `e2e/tests/app/PR022-scope-this-event.spec.ts` |
| PR023 | member | On a recurring occurrence, member picks "This and following"; the series splits at that occurrence                   | `e2e/tests/app/PR023-scope-following.spec.ts`  |
| PR024 | member | On a recurring occurrence, member picks "All events"; the entire series is updated                                   | `e2e/tests/app/PR024-scope-all.spec.ts`        |

---

## Availability (Phases 25–27)

| ID    | Role   | Happy-path description                                                                                                  | Spec path                                        |
| ----- | ------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| PR025 | member | Member edits their available-time windows (weekly patterns and ad-hoc dates); computed availability reflects the change | `e2e/tests/app/PR025-edit-availability.spec.ts`  |
| PR026 | member | Member adds a one-off and a recurring blocked time; they show busy in the availability view                             | `e2e/tests/app/PR026-blocked-times.spec.ts`      |
| PR027 | member | Member views a colleague's free/busy over a date range without private event detail                                     | `e2e/tests/app/PR027-check-availability.spec.ts` |

---

## Calendar Groups (Phases 28–29)

| ID    | Role  | Happy-path description                                                                  | Spec path                                  |
| ----- | ----- | --------------------------------------------------------------------------------------- | ------------------------------------------ |
| PA028 | admin | Admin views the org's Calendar Groups in a datatable                                    | `e2e/tests/app/PA028-groups-list.spec.ts`  |
| PA029 | admin | Admin creates a Calendar Group with named slots and calendar pools; it becomes bookable | `e2e/tests/app/PA029-create-group.spec.ts` |

---

## Calendar Bundles (Phases 30–32)

| ID    | Role  | Happy-path description                                                                          | Spec path                                    |
| ----- | ----- | ----------------------------------------------------------------------------------------------- | -------------------------------------------- |
| PA030 | admin | Admin creates a bundle (child calendars + one primary); it appears in all-calendars as a bundle | `e2e/tests/app/PA030-create-bundle.spec.ts`  |
| PA031 | admin | Admin edits a bundle's children, primary, and name; changes persist                             | `e2e/tests/app/PA031-update-bundle.spec.ts`  |
| PA032 | admin | Admin disables a bundle after confirming; it stops appearing in active pickers                  | `e2e/tests/app/PA032-disable-bundle.spec.ts` |

---

## Sync & Rooms (Phases 33–35)

| ID    | Role  | Happy-path description                                                              | Spec path                                        |
| ----- | ----- | ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| PA033 | admin | Admin enables and configures rooms (resource) sync for the org; configuration saves | `e2e/tests/app/PA033-rooms-sync-config.spec.ts`  |
| PA034 | admin | Admin triggers a rooms sync; a toast confirms "sync started"                        | `e2e/tests/app/PA034-trigger-rooms-sync.spec.ts` |
| PA035 | admin | Admin triggers a sync of another user's calendar; a toast confirms "sync started"   | `e2e/tests/app/PA035-sync-user-calendar.spec.ts` |

---

## Admin Event Control (Phase 36)

| ID    | Role  | Happy-path description                                                                            | Spec path                                    |
| ----- | ----- | ------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| PA036 | admin | Admin transfers an event to another user's calendar; source and destination both reflect the move | `e2e/tests/app/PA036-transfer-event.spec.ts` |

---

## API Tokens (Phases 37–38)

| ID    | Role  | Happy-path description                                                                                     | Spec path                                      |
| ----- | ----- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| PA037 | admin | Admin generates a scoped API token; the secret is shown once with copy + warning, never re-displayed       | `e2e/tests/app/PA037-generate-token.spec.ts`   |
| PA038 | admin | Admin invalidates an API token after confirming; it is marked invalidated and rejected on subsequent calls | `e2e/tests/app/PA038-invalidate-token.spec.ts` |

---

## Policy Pages (SMS MFA Consent Frontend — Phases 2–3)

| ID    | Role   | Happy-path description                                                                                                      | Spec path                                                                                  |
| ----- | ------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| PR039 | member | Visitor (no session) opens `/privacy` and sees the latest published Privacy Policy, or a placeholder when none is published | N/A — public server-rendered page, no e2e spec (`src/app/privacy/page.test.tsx` unit test) |
| PR040 | member | Visitor (no session) opens `/terms` and sees the latest published Terms of Use, or a placeholder when none is published     | N/A — public server-rendered page, no e2e spec (`src/app/terms/page.test.tsx` unit test)   |

---

## Signup Consent (SMS MFA Consent Frontend — Phase 4)

| ID    | Role   | Happy-path description                                                                                                                                                                                                          | Spec path                                                                         |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| PR041 | member | Visitor signing up with email/password must check two distinct consent boxes (Privacy Policy/Terms of Use, SMS consent); unchecking either blocks submission with an inline error, and a checked submission POSTs both booleans | N/A — unit test only (`src/app/auth/signup/page.test.tsx`), no e2e spec by design |

---

## Social Finish-Signup Consent (SMS MFA Consent Frontend — Phase 5)

| ID    | Role   | Happy-path description                                                                                                                                                                                                                                                                                                        | Spec path                                                                                                 |
| ----- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| PR042 | member | Visitor finishing social (OAuth) signup must check the same two distinct consent boxes (Privacy Policy/Terms of Use, SMS consent); unchecking either blocks submission with an inline error, and a checked submission POSTs both booleans and still completes the provider-signup flow (including the `verify_phone` handoff) | N/A — unit test only (`src/components/authentication/finish-signup-form.test.tsx`), no e2e spec by design |

---

## Counts

| Category      | Count  |
| ------------- | ------ |
| Member (`PR`) | 28     |
| Admin (`PA`)  | 14     |
| **Total**     | **42** |

_Foundation smoke (PR000) is not counted in the 42 use-cases — it is harness scaffolding. PR039–PR042 have no Playwright spec by design — see the SMS MFA Consent Frontend implementation plan, Phases 2–5._
