# Public Scheduling Links — Implementation Plan

Frontend plan for generating shareable scheduling links against calendars and calendar
groups, so an external attendee can book, reschedule, or cancel without an account.

The backend contract is **already built and merged** on `vinta-schedule-api@main` (plan:
`ai-plans/2026-09-01-REST_CODE_GATED_SCHEDULING_IMPLEMENTATION_PLAN.md`, Phases 0–7). Two of
its phases are written but not yet implemented — **Phase 8** (patient self-service management
codes) and **Phase 9** (public-group flag and codeless discovery reads) — and the phases that
depend on them name them as prerequisites rather than restating a contract we do not own.

**Verified against `vinta-schedule-api@main` at `272c5e33`.** Part of API Phase 9 landed ahead
of the rest: `CalendarGroupSerializer` now carries both `duration` and
`accepts_public_scheduling`, closing the gap an earlier draft of this plan raised. **Phase 6 is
therefore unblocked** and needs only Phase 0. Still pending: API Phase 8 in full (no
`management` object on any response) and API Phase 9's four codeless slug-addressed reads (no
new paths), which continue to block Phases 5 and 7 respectively.

There is no `..._SPEC.md` sibling. The decisions a spec would carry were settled in the
planning interview and are recorded in **Guiding Decisions** below; every assumption is marked
as such.

## 1. Goals

1. An organization member can generate a shareable scheduling link for a calendar they own or
   a calendar group they participate in, copy it once, and revoke it.
2. An external attendee holding a link can see real bookable slots and book an appointment
   with no account and no credential beyond the link itself.
3. The same mechanism covers group bookings, where the attendee's booking resolves each of the
   group's slots to concrete calendars.
4. An external attendee can reschedule or cancel their own appointment from a link.
5. Once the backend's Phase 9 lands, a calendar group can expose a **reusable** public
   scheduling link that many people can book against, instead of one link per invitee.

**Non-goals:**

- **A "my booking links" listing page.** The API deliberately exposes no `list` or `retrieve`
  for booking codes — the plaintext code is returned exactly once at mint and is never
  re-derivable. See the **No link inventory** row in **Guiding Decisions**.
- **Codeless single-calendar booking.** The backend explicitly declines it
  (`accepts_public_scheduling` lives on `CalendarGroup`, never on `Calendar`), so a
  single-calendar link is always code-gated.
- **Server-enforced duration on single-calendar links.** The backend deliberately dropped
  per-code duration pinning and did not add `Calendar.duration`. See **Single-calendar
  duration is advisory**.
- **Rate limiting or abuse mitigation on the public surface.** The backend's own plan records
  the unauthenticated surface as deliberately unthrottled. Nothing the frontend does changes
  that; it is named here only so it is not mistaken for an oversight on this side.
- **Calendar Pools.** A separate feature landed on API `main` in parallel (`/calendar-pools/`,
  `/calendar-groups/{id}/stale-selections/`, `pools` / `pool_ids` added to
  `CalendarGroupSlot`, changed roster-removal semantics, with its own client handoff at
  `ai-plans/2026-09-01-CALENDAR_POOLS_CLIENT_HANDOFF.md` in the API repo). It is additive to
  the slot shape, so the group booking flow's `calendars` + `required_count` path is
  unaffected. It gets its own plan.
- **Any change to `src/client/` by hand.** It is regenerated.

## 2. Guiding Decisions

| Decision                                                          | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **No invented contract**                                          | The REST surface exists on API `main`. Phase 0 syncs `schema.yml` and regenerates the hey-api client; every later phase consumes generated operations. Where a phase needs something not yet built, it names the backend phase that builds it instead of specifying a substitute.                                                                                                                                                                                                                                                                                                          |
| **Code transport**                                                | The booking code travels as an `X-Booking-Code` request header on every `/public/booking/*` call — never in a path segment or body. The code reaches the page through the URL; the page moves it into the header. hey-api emits header params as a typed `headers` field on the operation, so this is a typed call, not a hand-rolled fetch.                                                                                                                                                                                                                                               |
| **A dedicated unauthenticated client**                            | Public booking pages call through a bare hey-api client with **no** interceptors, not the shared `client` from `@/lib/configure-api-clients`. The shared client injects `Authorization` and `X-Organization-Id` on every request ([authentication-fetch-interceptors.ts:60-81](../src/lib/authentication-fetch-interceptors.ts#L60-L81)); sending a logged-in visitor's org header to a `/public/booking/*` endpoint is at best noise on a surface whose entire design keeps the organization out of the request. hey-api supports a per-call `client` override, so this costs one module. |
| **The opaque 403 is not an auth failure**                         | Code-gated reads answer _every_ code failure — invalid, expired, used, revoked, wrong-scope — with the same `403 {"detail": "Invalid or expired code."}`, deliberately, so the endpoint cannot be used to probe code state. The response interceptor's 403 branch only fires on `detail === 'Authentication credentials were not provided.'`, so it passes this through untouched — but the public pages bypass that interceptor anyway. The UI must render one undifferentiated "this link is no longer valid" state and must not guess which failure it was.                             |
| **Writes carry a real error vocabulary**                          | Unlike reads, writes return distinct statuses plus `{"error_code", "detail"}`: `404 INVALID_CODE`, `403 NOT_PERMITTED` / `REVOKED`, `410 EXPIRED`, `409 ALREADY_USED`, `409 SLOT_UNAVAILABLE`. `SLOT_UNAVAILABLE` **does not consume the code**, so it is the one failure the UI recovers from in place — send the attendee back to slot selection rather than to a dead end.                                                                                                                                                                                                              |
| **No link inventory**                                             | The API exposes no `list` / `retrieve` for booking codes and its Open Questions rejects adding one ("there is nothing safe to return about a code after mint"). So there is no management page. A link is shown exactly once, in the dialog that mints it, with a copy control and a revoke control while the id is still in hand. The dialog must say plainly that the link cannot be shown again.                                                                                                                                                                                        |
| **Single-calendar duration is advisory**                          | The backend dropped per-code duration pinning and put duration on `CalendarGroup` only, calling single-calendar bookings "deliberately unconstrained". So a calendar link carries `?duration=<seconds>`, chosen by the minting member. It is tamperable, and that is acceptable **because there is no server-side pin for it to bypass** — the booking policy (lead time, horizon, buffers) remains the real guard. Documented alternative for anyone who wants it enforced: wrap the calendar in a one-slot group and set the group's `duration`.                                         |
| **Group duration comes from the server**                          | Group links carry no duration in the URL. `CalendarGroup.duration` pins the span, enforced in `CalendarPermissionService` across every surface. The page reads the length from the returned proposals' spans.                                                                                                                                                                                                                                                                                                                                                                              |
| **`CalendarGroup.duration` is a string on the wire, not seconds** | It is a DRF `DurationField`, so the generated type is `duration?: string` in Django's `[DD] [HH:[MM:]]ss[.uuuuuu]` form — **not** the `duration_seconds` integer used by every slot read, by the removed mint field, and by the GraphQL mutations. The group settings form must convert both ways at that one boundary, in a tested helper, rather than passing a number and hoping. This asymmetry is the single easiest thing to get wrong in Phase 6.                                                                                                                                   |
| **Group settings are tri-state; `null` is refused**               | On `CalendarGroupSerializer`, both `duration` and `accepts_public_scheduling` are `required=False, allow_null=False`: absent means "leave unchanged", and an explicit `null` is a validation error rather than a clear. **A duration cannot be cleared at all** — doing so on a public group would fail open. So a PATCH must omit fields it is not changing and must never send `null` to reset one.                                                                                                                                                                                      |
| **Read the duration off the proposals, never off local state**    | On the code-gated slot reads a pinned duration silently overrides the client's `duration_seconds` — no error, no warning, by design, so the endpoint cannot be used to test whether a code pins one. A page that renders its own requested duration will therefore lie whenever a pin disagrees. Render what came back.                                                                                                                                                                                                                                                                    |
| **Two public routes, one branded**                                | `/o/[slug]/book/[code]` is the branded route, resolving branding through the existing [`fetchBrandingForSlug`](../src/lib/branding-server.ts) used by the branded login page. `/book/[code]` works but renders default branding, because a page holding only a code has no way to look up its organization — there is no retrieve endpoint. The mint dialog builds the branded URL, since the app already knows the active org's slug.                                                                                                                                                     |
| **Purpose is in the path, not discoverable from the code**        | A code does not reveal its own purpose, so the reschedule and cancel pages live at distinct routes (`.../book/[code]/reschedule`, `.../book/[code]/cancel`) and the minting side, which knows the purpose it asked for, builds the right URL.                                                                                                                                                                                                                                                                                                                                              |
| **Authorization mirrors the server's rule**                       | Minting is owner-or-org-admin: an org admin may mint for any calendar or group; another member only for a calendar they own or a group they participate in. The frontend predicate follows the existing [`canEditCalendar`](../src/components/calendar-groups/group-permissions.ts#L38-L44) shape — pure, framework-free, unit-tested — and is a UI affordance only. The server is the authority; a hidden button is not a permission check.                                                                                                                                               |
| **No feature flag — additive surface**                            | Decided by the requester after the risk was raised. Every route is new, and the admin-side change is an added row action on two existing tables plus one detail view — no existing query path, response shape, or rendering branch changes. The repo has no feature-flag mechanism, and the API shipped its own equivalent surface unflagged for the same reason. **Consequence accepted:** a regression in the added row actions on `/calendars` or `/groups` has no kill switch and must be fixed forward. There is therefore no flag-removal phase.                                     |
| **Phase granularity**                                             | Bundled by concern, not one-per-use-case — chosen by the requester. Each phase stays MR-sized, single-concern, independently mergeable, and ships its own tests.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **No e2e in this plan**                                           | Unit + integration only, per the repo default. The public pages are unauthenticated but need a _live, valid, single-use_ code per run, which a Playwright fixture cannot mint without an authenticated seeding step — and every run would burn codes. E2E can be added per-flow later via [add-e2e-test](../.claude/skills/add-e2e-test/SKILL.md).                                                                                                                                                                                                                                         |

## 3. Data Model Changes

This repo has no database. "Data model" here means the generated client types and the small
amount of local type plumbing built on top of them.

### 3.1 Regenerated client types (Phase 0)

Syncing [schema.yml](../schema.yml) from `vinta-schedule-api@main` and running
`pnpm run openapi-ts` introduces, in `src/client/`:

| Type                           | Shape                                                                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BookingCodeCreate`            | `{ purpose, calendar?, calendar_group?, event?, expires_at? }` — request body for the mint endpoint. **Note there is no `duration_seconds`**; it was removed when duration moved to `CalendarGroup`. |
| `BookingCodeCreateResult`      | `{ id, code, purpose, calendar, calendar_group, event, expires_at }` — the one and only time `code` is ever returned.                                                                                |
| `PurposeEnum`                  | `'book' \| 'reschedule' \| 'cancel'`                                                                                                                                                                 |
| `BookingCodeEventCreate`       | `{ title, description?, start_time, end_time, timezone, external_attendee }`                                                                                                                         |
| `BookingCodeGroupEventCreate`  | the above plus `slot_selections: _CalendarGroupSlotSelectionInput[]`                                                                                                                                 |
| `BookingCodeReschedule`        | `{ start_time, end_time, timezone }` — times only; title, description, attendees and resource allocations are snapshotted server-side from the existing event.                                       |
| `_BookingCodeExternalAttendee` | `{ email, name? }`                                                                                                                                                                                   |

Generated operations follow the repo's existing `snake_case` → `camelCase` operationId
convention (compare [`calendarGroupsBookableSlotsList`](../src/client/sdk.gen.ts#L3129)):
`bookingCodesCreate`, `bookingCodesDestroy`, `publicBookingCalendarBookableSlotsList`,
`publicBookingCalendarGroupBookableSlotsList`, `publicBookingCalendarGroupAvailabilityCreate`,
`publicBookingCalendarEventsCreate`, `publicBookingCalendarGroupsEventsCreate`,
`publicBookingEventsRescheduleCreate`, `publicBookingGroupEventsRescheduleCreate`,
`publicBookingEventsCancelCreate`.

`CalendarGroup` also gains the two fields Phase 6 needs, both optional and both writable only
by an org admin (enforced at the viewset by `CalendarGroupPermission`, so a non-admin's request
is refused whole rather than having the fields dropped):

| Field                       | Type      | Notes                                                                                                                         |
| --------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `duration`                  | `string`  | Django duration form, **not** seconds — see the wire-format row in **Guiding Decisions**.                                     |
| `accepts_public_scheduling` | `boolean` | Gates codeless booking. Setting it true while the group's effective duration is unset is a `400`, on create and update alike. |

The same regeneration also pulls in the unrelated Calendar Pools additions (`CalendarPool`,
`StaleSelection`, `pools` / `pool_ids` on `CalendarGroupSlot`). They are additive; Phase 0 only
has to confirm the existing group booking flow still typechecks against them.

### 3.2 Link model (Phase 1) — `@src/lib/booking-links/types.ts`

A minted link is not a server resource the frontend can re-read, so it exists only as an
in-memory value passed from the mint call to the dialog that displays it:

```ts
export interface MintedBookingLink {
  /** Server id — the only handle revoke accepts. Lost when the dialog closes. */
  id: number;
  purpose: PurposeEnum;
  /** Absolute URL handed to the member, already branded when a slug was known. */
  url: string;
  expiresAt: string | null;
  /** Seconds, calendar-scoped links only; null for group links (server-pinned). */
  durationSeconds: number | null;
}
```

### 3.3 Error plumbing (Phase 0) — `@src/lib/booking-links/errors.ts`

```ts
export type BookingCodeErrorCode =
  | 'INVALID_CODE'
  | 'NOT_PERMITTED'
  | 'REVOKED'
  | 'EXPIRED'
  | 'ALREADY_USED'
  | 'SLOT_UNAVAILABLE';

/** Reads collapse every code failure into one opaque state — never guess which. */
export type PublicReadState = 'ok' | 'link-invalid' | 'range-invalid' | 'error';

/** Writes discriminate; `SLOT_UNAVAILABLE` is the only recoverable one. */
export interface PublicWriteFailure {
  errorCode: BookingCodeErrorCode | null;
  detail: string;
  /** True only for SLOT_UNAVAILABLE — the code survives, so retry in place. */
  isRetryable: boolean;
}
```

## 4. API Design

No API is designed here — it exists. This section records the operations each phase consumes
and the two contract gaps this plan depends on being closed elsewhere.

### 4.1 Consumed today (API `main`, Phases 0–7)

| Operation                                                    | Auth                                                     | Used by          |
| ------------------------------------------------------------ | -------------------------------------------------------- | ---------------- |
| `POST /booking-codes/`                                       | session/JWT, owner-or-org-admin                          | Phase 1, Phase 4 |
| `DELETE /booking-codes/{id}/`                                | same; idempotent, always `204`                           | Phase 1          |
| `GET /public/booking/calendar-bookable-slots/`               | `X-Booking-Code`                                         | Phase 2          |
| `POST /public/booking/calendar-events/`                      | `X-Booking-Code`                                         | Phase 2          |
| `GET /public/booking/calendar-group-bookable-slots/`         | `X-Booking-Code`                                         | Phase 3          |
| `POST /public/booking/calendar-group-availability/`          | `X-Booking-Code`                                         | Phase 3          |
| `POST /public/booking/calendar-groups/{public_slug}/events/` | `X-Booking-Code` (optional — codeless branch is Phase 7) | Phase 3, Phase 7 |
| `POST /public/booking/events/reschedule/`                    | `X-Booking-Code`                                         | Phase 4          |
| `POST /public/booking/group-events/reschedule/`              | `X-Booking-Code`                                         | Phase 4          |
| `POST /public/booking/events/cancel/`                        | `X-Booking-Code`                                         | Phase 4          |

`GET /public/booking/available-times/`, `.../availability-windows/` and
`.../unavailable-windows/` are code-gated reads this plan does not consume — the bookable-slots
reads already give the page what it needs.

### 4.2 Depends on API Phase 8 — patient self-service management codes

Blocks **Phase 5**. Adds a `management` object to the `201` of both booking creates and both
reschedules, carrying freshly minted `reschedule_code` and `cancel_code` bound to the new
event. Reschedule re-issues a fresh pair so the chain continues; cancel returns `204` and
issues nothing. `expires_at` defaults to the **event's end time** — the requester reviewed the
divergence from their own earlier "event start" preference and accepted the backend's default.

### 4.3 Landed early — group public-scheduling fields

**Unblocks Phase 6.** An earlier draft of this plan flagged that `CalendarGroup.duration` was
on the model but absent from `CalendarGroupSerializer`, while API Phase 9 as written added only
`accepts_public_scheduling` — leaving the frontend able to flip the flag but unable to satisfy
the invariant that flip creates. Both fields are now on the serializer (API `main`, `2657e7ba`
and `db57a4f3`), ahead of the rest of Phase 9.

The invariant is validated against the group's **effective** state — incoming values where
provided, persisted values otherwise — on both create and update. So a private group with no
duration can be flipped public _and_ given a duration in a single `PATCH`, which is the call
Phase 6's form should make. Asking for public scheduling without a length is a normal `400`
carrying "A CalendarGroup that accepts public scheduling must have a duration set", not a `500`.

### 4.4 Depends on API Phase 9 — codeless discovery reads

Still pending; blocks **Phase 7** only. Four codeless, slug-addressed reads:
`GET /public/booking/calendar-groups/{slug}/bookable-slots/`, `POST .../availability/`, and
aggregated `GET .../availability-windows/` and `.../unavailable-windows/`. They take no
`duration_seconds` — the length comes from `group.duration`, and a null-duration group answers
`403`. Confirmed absent from API `main` at `272c5e33` (no new paths in `schema.yml`).

Note the asymmetry this leaves in the meantime: the codeless **write**
(`POST /public/booking/calendar-groups/{public_slug}/events/` with no `X-Booking-Code`) has
shipped, but nothing can discover a time to send it. A reusable link is bookable-in-principle
and unusable-in-practice until these reads land — which is why Phase 6 stops at the settings
and Phase 7 owns the link and the page together.

## 5. Phased Rollout

### Phase 0 — Client regeneration and public-booking plumbing

**Goal**: Ship value: none on its own. Every later phase calls generated operations that do not
exist in this repo yet, and all four public pages need one unauthenticated client and one error
mapper. Building those three things once, with tests, keeps them out of the phase that first
happens to need them.

**Feature flag**: none — see the **No feature flag** row in **Guiding Decisions**. This phase
adds no reachable behavior at all.

Changes:

1. Sync [schema.yml](../schema.yml) from `vinta-schedule-api@main` and run
   `pnpm run openapi-ts`. Commit the regenerated `src/client/` as codegen output, staging
   explicit paths (the repo forbids `git add -A`).
2. Confirm the unrelated Calendar Pools additions (`pools` / `pool_ids` on `CalendarGroupSlot`,
   `CalendarPool`, `StaleSelection`) typecheck against the existing group booking flow in
   [use-group-booking.ts](../src/hooks/calendar-groups/use-group-booking.ts). They are
   additive; if anything breaks, that is a finding for the Calendar Pools plan, not a fix here.
3. `@src/lib/booking-links/public-client.ts`: a hey-api client created with no interceptors,
   pointed at `NEXT_PUBLIC_API_BASE_URL`, exported for the public pages to pass as the per-call
   `client` option. Document _why_ it exists — the shared client injects `Authorization` and
   `X-Organization-Id`, which have no business on `/public/booking/*`.
4. `@src/lib/booking-links/errors.ts`: the types from **Data Model Changes → Error plumbing**
   plus `parseWriteFailure(response, body)` and `parseReadFailure(response)`. The read parser
   must map every `403` to one opaque `'link-invalid'` and must not branch on `detail`.
5. `@src/lib/booking-links/build-url.ts`: given `{ code, purpose, slug?, durationSeconds? }`,
   return the absolute link. Branded when a slug is supplied, bare otherwise; `?duration=` only
   for calendar-scoped `book` links; purpose appended as a path segment for reschedule/cancel.

Spec use-case: shared scaffolding — no use-case yet.

Tests:

- **Unit**: `@src/lib/booking-links/errors.test.ts` — each write status/`error_code` pair maps
  to the right `PublicWriteFailure`, `SLOT_UNAVAILABLE` is the only `isRetryable: true`, and a
  `403` on the read path maps to `'link-invalid'` for several different `detail` bodies,
  proving the parser does not leak the distinction.
- **Unit**: `@src/lib/booking-links/build-url.test.ts` — branded vs bare, duration present only
  for calendar `book` links, purpose segment for reschedule and cancel.
- **Unit**: `@src/lib/booking-links/public-client.test.ts` — a request issued through this
  client carries neither `Authorization` nor `X-Organization-Id` even when a token and an
  active organization are present in `localStorage`. This is the regression test for the whole
  decision; do not drop it.

**Suggested AI model**: Tier 2 (IDs in
[resources/ai-models.yaml](../.claude/skills/plan-feature/resources/ai-models.yaml) —
`last_verified: 2026-07-13`, so confirm the IDs still resolve before relying on them). Codegen
plus three small pure modules with established precedent, but the client-isolation module has a
real correctness requirement rather than being boilerplate.

**Reusable skills**: none — no route, component, or data hook lands here.

Acceptance: `pnpm run typecheck`, `pnpm run lint` and `pnpm run test` are clean with the
regenerated client in the tree; `bookingCodesCreate` and the eight `publicBooking*` operations
are importable from `@/client/sdk.gen`; and a request issued through the public client carries
no auth or organization header.

---

### Phase 1 — Mint and revoke a scheduling link

**Goal**: A member can generate a shareable booking link for a calendar they own or a group
they participate in, copy it, and revoke it — from where they already manage those objects.

**Feature flag**: none — additive row actions plus a new dialog. Nothing existing changes
shape.

Changes:

1. `@src/hooks/booking-codes/use-create-booking-code.ts`: wraps `bookingCodesCreateMutation()`.
   Returns the `BookingCodeCreateResult` to the caller — **must not** write `code` into the
   query cache, localStorage, or any log; it is a live credential with exactly one delivery.
2. `@src/hooks/booking-codes/use-revoke-booking-code.ts`: wraps `bookingCodesDestroyMutation()`.
   The endpoint is idempotent and always `204`, so the hook reports success uniformly and never
   claims to have discovered whether the code existed.
3. `@src/lib/booking-links/can-mint-booking-link.ts`: pure predicate mirroring the server's
   owner-or-org-admin rule, following the shape and framework-free constraint of
   [group-permissions.ts](../src/components/calendar-groups/group-permissions.ts). Consumes
   `permissions` (via [`usePermissions`](../src/components/navigation/permission-gate.tsx#L45))
   and owned calendar ids (via `@/hooks/calendars/use-owned-calendar-ids`). Carry forward that
   module's load-bearing caveat: owned-calendar ids are trusted from the backend and the
   frontend has no independent signal to cross-check them.
4. `@src/components/booking-links/mint-booking-link-dialog.tsx`: target (calendar or group),
   optional expiry, and — for calendar targets only — a duration control. Group targets show no
   duration control and explain that the group's own duration applies. On success it switches
   to a one-time reveal: the URL, a copy button, an explicit "this link cannot be shown again"
   notice, and a revoke action live only while the dialog holds the id.
5. Row action in [calendars-table.tsx](../src/components/calendars/calendars-table.tsx) —
   there is no calendar detail page, so the table row is the entry point.
6. Row action in [groups-table.tsx](../src/components/calendar-groups/groups-table.tsx) and an
   action in [group-detail-view.tsx](../src/components/calendar-groups/group-detail-view.tsx).
7. Colocated `*.stories.tsx` for the dialog, covering the pre-mint form, the one-time reveal,
   and the revoked state.

Spec use-case: a member generates and shares a scheduling link.

Tests:

- **Unit**: `@src/lib/booking-links/can-mint-booking-link.test.ts` — the full matrix: org admin
  with no owned calendars, plain member with an owned calendar, plain member without, group
  participant, empty `permissions` array (a valid, normal value), and `null` permissions
  (unresolved — must not grant).
- **Integration**: `@src/components/booking-links/mint-booking-link-dialog.test.tsx` — minting
  a calendar link surfaces the URL with `?duration=`; minting a group link surfaces one
  without; the code is revealed exactly once and is gone after the dialog closes; revoke calls
  `bookingCodesDestroy` with the id and reports success; a failed mint reveals nothing.
- **Integration**: `@src/components/calendars/calendars-table.test.tsx` and
  `@src/components/calendar-groups/groups-table.test.tsx` — the action is present for an
  authorized viewer and absent for an unauthorized one, and every pre-existing assertion in
  both files still passes unchanged. That second half is what stands in for a flag-off test
  here, given the **no feature flag** decision: it is the evidence that the added row action
  did not disturb the tables.

**Suggested AI model**: Tier 3 (IDs in
[resources/ai-models.yaml](../.claude/skills/plan-feature/resources/ai-models.yaml)). Two data
hooks, a permission predicate, a stateful dialog with a one-time-reveal lifecycle, and edits
across three existing components.

**Review models**: reviewer Tier 4 — this phase handles a live credential that is delivered
exactly once and gates who may mint one. The failure modes worth an independent, capable read
are a `code` that leaks into the query cache, a log, or a story fixture, and a predicate that
grants minting more broadly than the server would.

**Reusable skills**: `new-hook` (both booking-code hooks); `new-composition` (the dialog);
`add-storybook-story` (dialog stories).

Acceptance: from `/calendars` and `/groups`, an authorized member mints a link, sees it once,
copies it, and revokes it; an unauthorized member sees no action; and the plaintext code appears
nowhere but that dialog's rendered output.

---

### Phase 2 — Public booking page, single calendar

**Goal**: Someone holding a calendar booking link picks a slot, enters their name and email,
and gets a confirmed appointment — with no account.

**Feature flag**: none — new routes, unreachable without a minted code.

Changes:

1. `@src/app/book/[code]/page.tsx` and `@src/app/o/[slug]/book/[code]/page.tsx`. Both sit
   outside the `(app)` route group, so the authenticated shell never gates them. The branded
   variant resolves branding through
   [`fetchBrandingForSlug`](../src/lib/branding-server.ts), following the branded login page
   ([o/[slug]/auth/login/page.tsx](../src/app/o/[slug]/auth/login/page.tsx)); an unknown slug
   falls back to default branding rather than erroring. The bare route renders default branding
   because a code cannot be resolved to an organization.
2. `@src/hooks/booking-codes/use-public-bookable-slots.ts`: wraps
   `publicBookingCalendarBookableSlotsList`, passing the code as `headers['X-Booking-Code']`
   and the Phase 0 public client. Reads `duration_seconds` from the URL. **Derives the
   rendered duration from the returned proposals, not from the query input** — a server-side
   pin silently overrides the request, so echoing local state would misreport it.
3. `@src/hooks/booking-codes/use-public-book-event.ts`: wraps
   `publicBookingCalendarEventsCreate`; maps failures through `parseWriteFailure`.
4. `@src/components/public-booking/`: `public-booking-shell.tsx` (branding chrome, shared by
   every public page), `slot-picker.tsx`, `attendee-form.tsx` (react-hook-form + zod: email
   required, name optional per `_BookingCodeExternalAttendee`), `booking-confirmation.tsx`, and
   `link-invalid.tsx` for the opaque read failure.
5. Timezone: default to `Intl.DateTimeFormat().resolvedOptions().timeZone` with an override
   control, since `timezone` is required on the write.
6. Error handling: an opaque read `403` renders `link-invalid`. On write, `SLOT_UNAVAILABLE`
   returns the attendee to slot selection with the slot list refetched — the code was not
   consumed and the attempt is genuinely retryable — while every other `error_code` is terminal.
7. Colocated stories for the shell, slot picker, confirmation, and invalid-link states.

Spec use-case: external attendee books on a single calendar.

Tests:

- **Integration**: `@src/components/public-booking/public-booking-flow.test.tsx` — slots
  render, submitting books and confirms; an opaque `403` on the slot read renders
  `link-invalid` and never a "expired" or "already used" wording; `409 SLOT_UNAVAILABLE` on
  submit returns to slot selection with slots refetched; `409 ALREADY_USED` and `410 EXPIRED`
  are terminal and distinct.
- **Integration**: proposals whose spans disagree with the URL's `?duration=` are rendered at
  the _proposal's_ length. This is the regression test for the silent-override rule.
- **Unit**: `@src/hooks/booking-codes/use-public-bookable-slots.test.ts` — the code reaches
  `X-Booking-Code`, the request goes through the public client, and no `Authorization` header
  is attached even with a token in `localStorage`.

**Suggested AI model**: Tier 3 (IDs in
[resources/ai-models.yaml](../.claude/skills/plan-feature/resources/ai-models.yaml)). Two new
routes, server-side branding resolution, a multi-step client flow, and an error taxonomy with
one recoverable branch.

**Reusable skills**: `new-page` (both routes); `new-hook` (both hooks); `new-composition`
(the public-booking components); `add-storybook-story`.

Acceptance: opening a valid calendar booking link at either route shows real slots and books an
appointment; a revoked, expired, or already-used link shows one undifferentiated invalid-link
page; and the branded route renders the organization's branding while the bare route renders the
default.

---

### Phase 3 — Public booking page, calendar group

**Goal**: The same public flow for a group link, where booking resolves each of the group's
slots to concrete calendars.

**Feature flag**: none.

Changes:

1. `@src/hooks/booking-codes/use-public-group-booking.ts`: wraps
   `publicBookingCalendarGroupBookableSlotsList`,
   `publicBookingCalendarGroupAvailabilityCreate`, and
   `publicBookingCalendarGroupsEventsCreate`, all through the public client with
   `X-Booking-Code`. The group-events route takes `public_slug` in the path; on the coded
   branch the server still resolves the group from the token and answers `403` (never `404`) on
   a mismatch, so the path is a routing convenience and the UI must not treat it as the
   authority.
2. Reuse the pure helpers already in
   [use-group-booking.ts](../src/hooks/calendar-groups/use-group-booking.ts) —
   `buildSlotAvailability`, `isSlotSatisfiable`, `isSelectionComplete`,
   `hasUnsatisfiableSlot`, `slotRequiredCount`. They are framework-free and were written to be
   consumed outside a React context, which is exactly this case. Extract them into
   `@src/lib/booking-links/group-selection.ts` **only if** importing them from the authenticated
   hook drags authenticated-client imports into the public bundle; if it does not, import them
   as they are and note why.
3. `@src/components/public-booking/group-slot-selection.tsx`: per-slot calendar selection
   driven by those helpers — only free candidates selectable, an unsatisfiable slot hard-blocks
   submit. The public variant must not render calendar owners' names beyond what the group
   endpoint already returns; this surface is unauthenticated.
4. Branch both public routes on the link's target. The page cannot introspect the code, so it
   attempts the calendar read and falls back to the group read on the opaque `403`, or the
   minting side marks the target in the URL. **Prefer the second** — one fewer request, and a
   probe-and-fallback turns the opaque `403` into exactly the oracle the backend designed it to
   prevent. Extend `build-url.ts` accordingly.
5. Colocated stories including the unsatisfiable-slot state.

Spec use-case: external attendee books through a calendar group.

Tests:

- **Integration**: `@src/components/public-booking/group-slot-selection.test.tsx` — a
  satisfiable group books with the right `slot_selections`; an unsatisfiable slot blocks
  submit; a busy candidate is not selectable.
- **Integration**: the group flow renders the server-pinned duration from the proposals and
  sends no `duration` of its own.
- **Unit**: whichever module ends up owning the selection helpers keeps its existing coverage
  green — if they move, `@src/components/calendar-groups/` tests must still pass untouched.

**Suggested AI model**: Tier 3 (IDs in
[resources/ai-models.yaml](../.claude/skills/plan-feature/resources/ai-models.yaml)). Three
operations, a non-trivial selection model, and a routing decision with a security consequence.

**Reusable skills**: `new-hook`; `new-composition`; `add-storybook-story`.

Acceptance: a group booking link shows group slots, lets the attendee complete a valid
selection, and books an event carrying the right `slot_selections`; an unsatisfiable slot
prevents submission; and the page never issues a speculative read to discover the link's target.

---

### Phase 4 — Admin-minted reschedule and cancel links

**Goal**: A member can send an attendee a link to reschedule or cancel a specific appointment,
and the attendee can use it without an account.

**Feature flag**: none.

Changes:

1. Extend the Phase 1 dialog to mint `purpose: 'reschedule'` and `purpose: 'cancel'` codes,
   which additionally require `event`. Add the action to the events surface
   (`@src/app/(app)/events/`) so a member mints against a specific appointment.
2. `@src/app/book/[code]/reschedule/page.tsx` and the `/o/[slug]/…` twin: slot picker plus
   confirm, posting to `publicBookingEventsRescheduleCreate` or
   `publicBookingGroupEventsRescheduleCreate`. The body is times only — title, description and
   attendees are snapshotted server-side and must not be rendered as editable.
3. `@src/app/book/[code]/cancel/page.tsx` and its twin: a confirmation step posting to
   `publicBookingEventsCancelCreate`, which returns `204`.
4. The two reschedule endpoints are deliberately not collapsed server-side, and cross-routing
   answers `403 NOT_PERMITTED` ("this code is scoped to a calendar group; use the group
   endpoint"). The minting side knows which it created, so encode it in the URL rather than
   discovering it by trying one and reading the error.
5. `@src/hooks/booking-codes/use-public-reschedule.ts` and `use-public-cancel.ts`.
6. Colocated stories for both pages, including their terminal states.

Spec use-case: external attendee reschedules or cancels their appointment.

Tests:

- **Integration**: `@src/components/public-booking/reschedule-flow.test.tsx` — a valid
  reschedule link shows slots and reschedules; a cancel link confirms and cancels on `204`.
- **Integration**: a group-scoped reschedule code routed to the single-calendar endpoint is
  never attempted — assert on the URL built at mint time, not on recovery from a `403`.
- **Integration**: `ALREADY_USED` on either page is terminal and worded distinctly from the
  reads' opaque invalid-link state.
- **Integration**: the reschedule page exposes no editable title, description, or attendee
  field.

**Suggested AI model**: Tier 3 (IDs in
[resources/ai-models.yaml](../.claude/skills/plan-feature/resources/ai-models.yaml)). Four new
routes reusing Phase 2's shell and Phase 3's picker, plus a mint-side extension.

**Reusable skills**: `new-page`; `new-hook`; `new-composition`; `add-storybook-story`.

Acceptance: a member mints a reschedule and a cancel link against a specific event; each link
performs exactly its own action and nothing else; and neither page offers a field the endpoint
would ignore.

---

### Phase 5 — Attendee self-service links on confirmation

**Prerequisite**: **API Phase 8** (patient self-service management codes) is merged and
deployed. Until then this phase is not buildable — the `management` object does not exist on
any response.

**Goal**: An attendee who books gets their own reschedule and cancel links immediately, instead
of needing a member to mint one by hand.

**Feature flag**: none.

Changes:

1. Regenerate the client against the API `main` that carries Phase 8, picking up `management`
   on the `201` of both booking creates and both reschedules.
2. `@src/components/public-booking/booking-confirmation.tsx`: render the returned
   `reschedule_code` and `cancel_code` as links built through `build-url.ts`, with copy
   controls and a plain statement of when they expire — the backend defaults `expires_at` to
   the **event's end time**.
3. The reschedule page re-renders a _fresh_ pair from its own `201`, so the chain continues.
   Cancel returns `204` and issues nothing; the confirmation must say the appointment is gone
   and offer no further link.
4. These are live credentials rendered in a public page. Keep them out of analytics, error
   reporting, and any URL the page itself navigates to.

Spec use-case: external attendee manages their own appointment.

Tests:

- **Integration**: booking renders working reschedule and cancel links; rescheduling with one
  renders a fresh pair; cancelling renders none.
- **Integration**: a `201` with no `management` object (an older backend) renders the
  confirmation without self-service links rather than crashing.
- **Integration**: neither code appears in any `router.push` argument or reporting payload.

**Suggested AI model**: Tier 2 (IDs in
[resources/ai-models.yaml](../.claude/skills/plan-feature/resources/ai-models.yaml)).
Rendering two fields on an existing confirmation component, once the contract lands.

**Reusable skills**: `add-storybook-story`.

Acceptance: with API Phase 8 deployed, a public booking's confirmation shows working reschedule
and cancel links; rescheduling issues a fresh pair; cancelling issues none; and a response
lacking `management` degrades to Phase 2's confirmation.

---

### Phase 6 — Group public-scheduling settings

**Prerequisite**: none beyond Phase 0 — **unblocked** as of API `main` `272c5e33`, which put
both `duration` and `accepts_public_scheduling` on `CalendarGroupSerializer`. Despite its
number this phase may ship any time after Phase 0; it is ordered here because it belongs with
the reusable-link story, not because anything before it is required.

**Goal**: An org admin can mark a calendar group as publicly bookable and set the appointment
length that applies to it.

**Feature flag**: none.

Changes:

1. Regenerate the client (or inherit Phase 0's); `duration` and `accepts_public_scheduling`
   appear on `CalendarGroup`.
2. `@src/lib/booking-links/duration-format.ts`: convert between the minutes the form works in
   and the Django duration **string** the field carries. Everything else in this domain speaks
   `duration_seconds` integers, so this boundary is the one place the two representations meet
   and it gets its own module and its own tests rather than being inlined.
3. `@src/components/calendar-groups/public-scheduling-settings.tsx` on the group detail view: a
   toggle plus a duration control. Enabling with no duration is blocked in the form — the
   server refuses it with a `400`, and the failure is better prevented than reported. Submit
   both changes in **one** `PATCH`, which the server's effective-state validation supports;
   omit any field not being changed and never send `null`, which is refused rather than read as
   a clear.
4. Gate the controls on the org-admin capability. Note this is presentation only and the server
   refuses a non-admin's whole request with `403` at `CalendarGroupPermission` — it does not
   silently drop the fields — so the UI must not imply a partial save is possible.
5. Colocated stories: off, on with duration, and the admin-vs-member read-only split.

Spec use-case: admin enables reusable public scheduling for a group.

Tests:

- **Unit**: `@src/lib/booking-links/duration-format.test.ts` — round-trips minutes ↔ the
  Django string form, including an hour boundary and a value with no hours component. This is
  the guard for the representation asymmetry called out in **Guiding Decisions**.
- **Integration**: an admin flipping the toggle and setting a length issues a single `PATCH`
  carrying both fields and no `null`; a group already public keeps its duration on an unrelated
  edit (the field is omitted, not resent).
- **Integration**: enabling without a duration is blocked before any request is sent; a
  non-admin sees the controls read-only.
- **Integration**: a group already public with a null duration (the backend grandfathers these
  at rest and refuses them at booking time) renders a warning rather than presenting it as
  healthy.

**Suggested AI model**: Tier 2 (IDs in
[resources/ai-models.yaml](../.claude/skills/plan-feature/resources/ai-models.yaml)). A form
section on an existing detail view following established patterns, plus one small pure
converter.

**Reusable skills**: `new-composition`; `add-storybook-story`.

Acceptance: an admin can make a private group publicly schedulable with a length in a single
request; a non-admin cannot; the no-duration invariant cannot be violated from the UI; and a
grandfathered null-duration public group is flagged rather than shown as healthy.

---

### Phase 7 — Reusable codeless group booking page

**Prerequisite**: the four codeless, slug-addressed reads from **API Phase 9** (see **API
Design → Depends on API Phase 9**), plus **Phase 6** for the settings that turn a group public.
The codeless _write_ already exists, so without the reads a codeless page can post a booking
but cannot show a single available time — which is why the reusable link is surfaced here
rather than in Phase 6, where it would point at a route that does not exist yet.

**Goal**: One link per group that any number of people can book against, instead of one link
per invitee.

**Feature flag**: none.

Changes:

1. `@src/app/o/[slug]/g/[public_slug]/page.tsx` and `@src/app/g/[public_slug]/page.tsx`:
   codeless public booking addressed by `public_booking_slug`.
2. `@src/hooks/booking-codes/use-codeless-group-booking.ts`: the slug-addressed reads plus
   `publicBookingCalendarGroupsEventsCreate` **with no `X-Booking-Code` header** — its absence
   is what selects the codeless branch.
3. Send no `duration_seconds`: these endpoints take none, and the length comes from
   `group.duration`. Render the length from the returned proposals.
4. Reuse Phase 2's shell and Phase 3's slot selection unchanged. The differences are the
   absent code, the slug in the path, and the error contract: unknown slug `404`, non-public
   group `403`.
5. Extend Phase 6's `public-scheduling-settings.tsx` to surface the group's
   `public_booking_slug` as a copyable reusable link, now that a page answers at that URL.
   Unlike a minted code this link is stable, re-readable, and safe to show repeatedly — say so,
   because every other link in this feature behaves the opposite way.
6. Colocated stories for the unknown-slug and not-public states.

Spec use-case: reusable public group scheduling link.

Tests:

- **Integration**: a public group's page shows slots and books with no code, and no request
  carries `X-Booking-Code`.
- **Integration**: an unknown slug renders not-found; a non-public group renders unavailable;
  the two are distinct, matching the endpoints' distinct statuses.
- **Integration**: booking twice through the same link succeeds both times — the property that
  distinguishes this from every code-gated phase.

**Suggested AI model**: Tier 2 (IDs in
[resources/ai-models.yaml](../.claude/skills/plan-feature/resources/ai-models.yaml)). Two
routes and one hook, reusing Phase 2's and Phase 3's components nearly wholesale.

**Reusable skills**: `new-page`; `new-hook`; `add-storybook-story`.

Acceptance: with API Phase 9 deployed, a publicly bookable group's slug URL shows real
availability and can be booked repeatedly by different people with no code; a private group's
does not.

## 6. Risk & Rollout Notes

**No feature flag, by decision.** Phases 1, 4 and 6 add actions to existing screens
(`/calendars`, `/groups`, group detail, events). A regression there ships to everyone with no
kill switch. The mitigation this plan carries instead is the requirement in each of those
phases that the touched components' **pre-existing tests pass unchanged** — that assertion is
standing in for a flag-off test and should not be dropped as redundant.

**A booking code is a credential with exactly one delivery.** `POST /booking-codes/` returns
the plaintext once and it is never re-derivable. Anything that drops it — a closed dialog, a
failed copy, a lost tab — means minting a new one and revoking the old. The dialog must say so.
Equally, the code must never reach the query cache, `localStorage`, a log, a URL the app
navigates to, or an error report. Phase 1's and Phase 5's reviews should look for exactly this.

**Revocation is only possible while the id is in hand.** With no list endpoint, a code whose id
was not retained cannot be revoked through this UI at all — it expires or is used. Members
should be told this at mint time. Anyone needing to revoke later goes through backend support,
using `minted_by_membership`, which the API added for audit and support queries specifically.

**The opaque read 403 is a deliberate design property, not a poor error message.** Any future
change that tries to tell an attendee _why_ their link failed on a read reintroduces the oracle
the backend removed. The wording may improve; the discrimination may not. Phase 0's parser test
is the guard.

**The public surface is unthrottled.** The API's own plan records this as an accepted risk,
with `slot_step_seconds` amplification called out. The frontend must not make it worse: no
polling of the public reads, no automatic retry loops on failure, and a sane fixed
`slot_step_seconds` rather than one derived from user input.

**Client regeneration is a wide diff in three phases.** Phases 0, 5 and 6 each regenerate
`src/client/`. Phase 0's also carries the unrelated Calendar Pools changes. Stage explicit
paths — the repo forbids `git add -A` because the tree carries untracked `.env*` files and
synced schema output.

**Deploy ordering.** Phases 0–4 **and 6** depend only on API `main` as it stands at `272c5e33`
and can ship in any order after Phase 0. Phases 5 and 7 must not merge before their named API
phase is **deployed**, not merely merged — a frontend reading `management` or calling a
codeless read against an older deployment degrades silently rather than failing loudly. Phase 5
has an explicit degradation test for this; Phase 7 does not degrade and must simply wait.

**Phase 6 ships a setting whose payoff arrives in Phase 7.** Making a group publicly
schedulable is real and enforced server-side the moment Phase 6 lands — the codeless write
endpoint already exists — but nobody can _discover_ a time to book until API Phase 9's reads
and our Phase 7 land. Shipping Phase 6 alone is safe and useful (it is the prerequisite
configuration), as long as it does not advertise a link to a route that answers 404. That is
why the copyable slug link lives in Phase 7.

**Rollback.** Every phase is additive and independently revertible. Reverting Phases 2, 3, 4 or
7 removes routes; reverting Phase 1 or 6 removes an action or a form section from an existing
screen. Nothing persists locally, so there is no state to unwind. Already-minted codes keep
working against the API regardless of what the frontend does — reverting this repo does not
revoke anything.

## 7. Open Questions

| Question                                                                                                                                   | Recommended default                                                                                                                                                                                                                                             | Owner   |
| ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| ~~API Phase 9 exposes `accepts_public_scheduling` but not `CalendarGroup.duration`, while a public group is required to have a duration.~~ | **Resolved 2026-09-04.** Both fields landed on `CalendarGroupSerializer` (API `main`, `2657e7ba` + `db57a4f3`), and the invariant is validated against effective state so one `PATCH` can flip and set together. Phase 6 is unblocked.                          | —       |
| Should single-calendar links get a server-enforced duration, via `Calendar.duration`? Today `?duration=` is advisory and tamperable.       | **Not now.** The API deliberately left single-calendar bookings unconstrained and named `Calendar.duration` as the later mechanism. Revisit if a customer actually reports a mis-length booking; the documented workaround is a one-slot group with a duration. | Product |
| Should a member be able to revoke a link after the minting dialog closes? Today they cannot — no list endpoint, no retained id.            | **Accept the limitation for v1** and state it in the dialog. Revisit only if support load justifies asking the API team to reverse a decision they made deliberately.                                                                                           | Product |
| The reschedule/cancel codes from API Phase 8 expire at the **event's end time**, so an attendee can cancel during their own appointment.   | **Accept** — reviewed and confirmed during planning. Flagged here only so a later reader does not mistake it for an oversight.                                                                                                                                  | Product |
| Should the public booking pages be indexable? They are unauthenticated routes carrying a credential in the URL.                            | **No — `noindex` on every `/book/*` and `/g/*` route.** A booking link in a search index is a leaked credential. Add the metadata in Phase 2 and carry it into every later public route.                                                                        | Eng     |

## 8. Touch List

**Phase 0**

- [schema.yml](../schema.yml) (synced from `vinta-schedule-api@main`)
- `src/client/` (regenerated — never hand-edited)
- `@src/lib/booking-links/public-client.ts`, `errors.ts`, `build-url.ts` + tests

**Phase 1**

- `@src/hooks/booking-codes/use-create-booking-code.ts`, `use-revoke-booking-code.ts`
- `@src/lib/booking-links/can-mint-booking-link.ts` + test
- `@src/components/booking-links/mint-booking-link-dialog.tsx` + test + stories
- [calendars-table.tsx](../src/components/calendars/calendars-table.tsx)
- [groups-table.tsx](../src/components/calendar-groups/groups-table.tsx)
- [group-detail-view.tsx](../src/components/calendar-groups/group-detail-view.tsx)

**Phase 2**

- `@src/app/book/[code]/page.tsx`, `@src/app/o/[slug]/book/[code]/page.tsx`
- `@src/hooks/booking-codes/use-public-bookable-slots.ts`, `use-public-book-event.ts`
- `@src/components/public-booking/public-booking-shell.tsx`, `slot-picker.tsx`,
  `attendee-form.tsx`, `booking-confirmation.tsx`, `link-invalid.tsx` + tests + stories

**Phase 3**

- `@src/hooks/booking-codes/use-public-group-booking.ts`
- `@src/components/public-booking/group-slot-selection.tsx` + test + stories
- `@src/lib/booking-links/build-url.ts` (target marker)
- possibly `@src/lib/booking-links/group-selection.ts` (only if the helpers must move out of
  [use-group-booking.ts](../src/hooks/calendar-groups/use-group-booking.ts))

**Phase 4**

- `@src/app/book/[code]/reschedule/page.tsx`, `@src/app/book/[code]/cancel/page.tsx` + branded twins
- `@src/hooks/booking-codes/use-public-reschedule.ts`, `use-public-cancel.ts`
- `@src/components/booking-links/mint-booking-link-dialog.tsx` (reschedule/cancel purposes)
- `@src/app/(app)/events/` (mint action)

**Phase 5** — blocked on API Phase 8

- `src/client/` (regenerated)
- `@src/components/public-booking/booking-confirmation.tsx` + test + stories

**Phase 6** — unblocked

- `@src/lib/booking-links/duration-format.ts` + test
- `@src/components/calendar-groups/public-scheduling-settings.tsx` + test + stories
- [group-detail-view.tsx](../src/components/calendar-groups/group-detail-view.tsx)

**Phase 7** — blocked on API Phase 9's codeless reads

- `@src/app/o/[slug]/g/[public_slug]/page.tsx`, `@src/app/g/[public_slug]/page.tsx`
- `@src/hooks/booking-codes/use-codeless-group-booking.ts` + tests + stories
- `@src/components/calendar-groups/public-scheduling-settings.tsx` (copyable slug link)

**Cross-repo (`vinta-schedule-api`)** — not this repo's work, tracked for coordination

- API Phase 8 — patient self-service management codes (blocks Phase 5)
- API Phase 9 — codeless discovery reads (blocks Phase 7)
- ~~`calendar_integration/serializers.py` — expose `CalendarGroup.duration`~~ — **done**
  (`2657e7ba`, `db57a4f3`), along with `accepts_public_scheduling`
