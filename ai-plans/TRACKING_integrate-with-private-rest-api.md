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

## Current Phase

- **Phase 7 — List my calendars (member)** (Tier 2) — starting (calendars block).

## Remaining Phases

7–38 (use-cases).

## Deferred / Superseded

- **Phase 0b** — MSW mock layer — superseded (live API).
- **Phase 39** — mock→live swap — superseded (live API).
- No cross-repo phases. No flag-removal phase (no feature flag).
