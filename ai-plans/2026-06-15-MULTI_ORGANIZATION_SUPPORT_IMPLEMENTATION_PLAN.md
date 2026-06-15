# Multi-Organization Support — Implementation Plan

> Source of truth for the backend contract: the **Multi-Organization Support (Backend Contract)**
> handoff (backend PRs #66–#82, **merged**). No `..._SPEC.md` sibling exists; this plan treats the
> handoff as the contract and names its rules where it implements them. Use-case ids below (UC1–UC6)
> are this plan's own labels for the handoff's "Recommended frontend flow" steps.

## 1. Goals

1. A user who belongs to **2+ organizations** must pick an active org at login when none is stored (on a
   dedicated auth-layout page, before the dashboard) and can switch it later from the sidebar org item;
   the choice persists across reloads and drives `X-Organization-Id` on every tenant-scoped request.
2. `X-Organization-Id` is injected on every tenant API call from a single source of truth, so single-org
   users resolve implicitly and multi-org users never hit the "header required" 400 in normal flow.
3. A user can **create another organization** from the switcher and land in it as admin.
4. A gated user (0 active memberships) can onboard by creating a first org **or** accepting an
   invitation; an already-onboarded user can accept an invite into an **additional** org.
5. Stale/invalid active-org selections (403) and missing-header (400) responses recover gracefully at
   the UI layer without a hard logout.

**Non-goals:**

- No global "the org" cached server-side or in a cookie — selection is **per-request**, client-only
  (no SSR awareness of active org in v1).
- No feature flag — shipped unflagged (see Guiding Decisions).
- No org **settings/management** surface (rename, delete, member admin) beyond what already exists —
  this plan only adds *switching*, *creating*, and *onboarding/accept*.
- No per-query-key org scoping refactor — switching invalidates the cache wholesale (see Guiding
  Decisions) rather than threading org id into every query key.
- No backend changes — contract is final and merged.
- No "last-used org per device sync" across devices — localStorage only.

## 2. Guiding Decisions

| Decision | Resolution |
| --- | --- |
| **Active-org source of truth** | A tiny module-level store at `@src/lib/active-organization.ts` (value + subscribers + `localStorage['activeOrganizationId']`). The request interceptor reads it **synchronously**; React reads it via `useSyncExternalStore`. *Why:* the interceptor is a module closure registered once — it can't read React state. A subscribable module store is the only thing both the fetch layer and components can share without a provider round-trip. Matches the existing module-level pattern (`sessionToken` in localStorage). |
| **Header injection site** | One request interceptor in [authentication-fetch-interceptors.ts](../src/lib/authentication-fetch-interceptors.ts), alongside the existing `Authorization` injector. Browser-only (guard `typeof window`), mirroring the `authClient` session-token interceptor. *Why:* single choke point; every generated SDK call already flows through `client`. |
| **Persistence + default** | `localStorage['activeOrganizationId']` (string). Stored-and-valid ⇒ used. **Single-org** caller with no valid stored id ⇒ auto-resolve to that one org (nothing to choose; header optional per contract). **Multi-org** caller with no valid stored id ⇒ **do not silently default** — redirect to a mandatory selection page before the dashboard (see next row). Stale stored id (not in `mine/`) ⇒ cleared, then the same single/multi rule applies. *Why:* survives reload, self-heals against deactivated memberships, and never guesses an org for a multi-org user. |
| **Login-time selection gate** | When an authenticated multi-org user reaches an `(app)` route with no valid stored selection, the layout redirects to a new auth-layout page `@/auth/select-organization` where they must pick before continuing to the dashboard. *Why:* user requirement — the choice is explicit, made on an auth page (outside the app shell), not implicitly defaulted. Single-org and already-selected users skip it. |
| **Switch mechanics** | On switch: `setActiveOrganizationId(id)` → `queryClient.invalidateQueries()` (all tenant queries refetch with the new header). *Why:* query keys don't include org id; wholesale invalidation is correct-by-construction and far smaller than refactoring every key. Acceptable because the app refetches on view, not on a hot path. |
| **Error recovery layer** | Surfaced to the **UI/hook layer**, not auto-retried in the interceptor. 400 (`X-Organization-Id header required`) → ensure a selection is set from `mine/`, then refetch (UC5, a guard that should be near-unreachable once selection primes the header). 403 on a tenant request → drop the stale selection, refetch `mine/`, re-pick default, toast (UC6). *Why:* user chose explicit UI handling; the interceptor already owns 401-refresh and shouldn't grow a second retry protocol with org-state side effects. |
| **`current/` 403 vs tenant 403** | `useCurrentOrganization` already maps `current/` 403 → `disabled` → `/no-access`. With multi-org, a deactivated membership drops from `mine/` and a stale header → 403; recovery is *re-pick*, not *no-access*. Phase 9 differentiates: re-pick when `mine/` still has orgs, fall through to existing disabled handling only when `mine/` is empty. *Why:* avoid bouncing a multi-org user to `/no-access` for a stale selection. |
| **No feature flag** | Shipped unflagged. *Why:* user decision. Header injection is harmless for single-org users (resolves implicitly) and the switcher only renders for 2+ orgs; no env-flag infra exists in the repo to lean on. Consequence: **no flag-removal phase**; risk mitigated by phase ordering (plumbing lands inert before any UI consumes it) and the flag-off-equivalent test in Phase 1 (header absent when no selection ⇒ byte-for-byte prior behavior). |
| **Client generation** | `schema.yml` refreshed from the backend repo (`~/Workspaces/vinta-schedule`, see [[schema-source-vinta-schedule]]) then `npm run openapi-ts`. Brings the `organizationsMine` operation, typed `Membership`/org-summary, and the `X-Organization-Id` optional header param onto tenant ops. *Why:* backend is merged; generate, don't hand-write. |

## 3. Data Model Changes

No persistent/backend models. Client-only state + types.

### 3.1 Active-organization store — `@src/lib/active-organization.ts` (new)

```ts
// Module-level, subscribable, localStorage-backed. Readable synchronously by the
// fetch interceptor and reactively by components (useSyncExternalStore).
const KEY = 'activeOrganizationId';
let current: string | null = /* lazy read from localStorage in browser */ null;
const subscribers = new Set<() => void>();

export function getActiveOrganizationId(): string | null { /* … */ }
export function setActiveOrganizationId(id: string | null): void { /* persist + notify */ }
export function subscribeActiveOrganization(cb: () => void): () => void { /* … */ }
export function clearActiveOrganization(): void { setActiveOrganizationId(null); }
```

### 3.2 Generated types (from Phase 0 regen)

`organizationsMine` returns a bare array `Membership[]` where
`Membership = { organization: { id: number; name: string }; role: RoleEnum }`. `CurrentMembership`
(already present, loosely `{ organization: { [k]: unknown }; role }`) tightens to the same org summary
shape after regen. Confirm exact generated names in Phase 0 and update consumers
([use-current-organization.ts](../src/hooks/organizations/use-current-organization.ts),
[app-layout-client.tsx](../src/components/navigation/app-layout-client.tsx) which currently does
`typeof membership.organization.name === 'string'` guards).

### 3.3 Type plumbing

- `useMyOrganizations` returns `{ memberships: Membership[]; isLoading; isError; … }`.
- `useActiveOrganization` returns `{ activeOrganizationId: string | null; setActive(id); activeMembership: Membership | null; memberships: Membership[] }`.

## 4. API Design

No new endpoints — consuming the merged contract:

| Operation | Method / Path | Header | Used by |
| --- | --- | --- | --- |
| `organizationsMine` | `GET /organizations/mine/` → `200 Membership[]` (bare array; `[]` when gated) | **omit** | Phase 2 hook, switcher source |
| `organizationsCurrentRetrieve` | `GET /organizations/current/` → `200 CurrentMembership` / `404` gated / `403` stale-or-disabled | honors header | existing hook (already wired) |
| `organizationsCreate` | `POST /organizations/` → `201` (caller becomes admin) | **exempt** | existing create hook |
| `invitationsAccept` | `POST /invitations/accept` | scoped | accept-invite flow |
| all other tenant ops | calendars, blocked/available times, groups, members, webhooks, … | `X-Organization-Id` injected | Phase 1 interceptor |

Header resolution rules (400 when 2+ orgs and header omitted; 403 when header names a non-member org)
are the handoff's table — handled in Phases 8–9.

## 5. Phased Rollout

Ordering: regenerate the client first (everything types off it), land **inert** header plumbing before
any UI reads it, then the data hook, then selection bootstrap, then visible UI, then onboarding/accept,
then error recovery. Each phase is independently mergeable and reversible; no phase breaks the build if
the next stalls.

---

### Phase 0 — Regenerate API client from merged backend schema

**Goal**: bring `organizationsMine` + tightened membership/org-summary types + the `X-Organization-Id`
header param into the generated client. No runtime behavior change.

Changes:

1. Refresh [schema.yml](../schema.yml) from `~/Workspaces/vinta-schedule` (see [[schema-source-vinta-schedule]]).
2. `npm run openapi-ts` → regenerates `src/client/**` (`sdk.gen.ts`, `types.gen.ts`, `@tanstack/react-query.gen.ts`).
3. Reconcile any type drift in existing consumers: the loose `organization.name` guards in
   [app-layout-client.tsx](../src/components/navigation/app-layout-client.tsx#L194-L199) and
   [use-current-organization.ts](../src/hooks/organizations/use-current-organization.ts) — keep guards
   if the generated org type is still loose, simplify if it tightened.

Spec use-case: shared scaffolding — no use-case yet.

Tests:

- **Unit**: existing suite green post-regen (regression guard). No new tests; this is generated code.
- Type-check (`tsc`) clean — proves consumers still compile against regenerated types.

**Suggested AI model**: Tier 1 — `claude-haiku-4-5` / `gpt-5-nano` / `gemini-2.5-flash-lite`. Mechanical regen + small type reconciliation against exact precedent.

**Reusable skills**: none.

Acceptance: `organizationsMine` exists in [sdk.gen.ts](../src/client/sdk.gen.ts) and `organizationsMineOptions` in the generated react-query module; `npm run build` + `tsc` pass.

---

### Phase 1 — Active-org store + header injection (inert)

**Goal**: every tenant request carries `X-Organization-Id` **when a selection exists**; absent selection
⇒ no header ⇒ byte-for-byte prior behavior. No UI sets the store yet — plumbing only.

Changes:

1. New `@src/lib/active-organization.ts` (Data Model Changes → store): get/set/subscribe/clear + localStorage.
2. [authentication-fetch-interceptors.ts](../src/lib/authentication-fetch-interceptors.ts): add a
   `client.interceptors.request.use` that sets `X-Organization-Id` from `getActiveOrganizationId()`
   when present and the header isn't already set. Browser-only guard, like the `authClient` session
   interceptor at [lines 96-108](../src/lib/authentication-fetch-interceptors.ts#L96-L108).

Spec use-case: shared scaffolding — no use-case yet (enables UC1–UC6).

Tests:

- **Unit**: `src/lib/active-organization.test.ts` — set persists to localStorage, get reads it, subscribe fires on change, clear resets.
- **Integration**: `src/lib/authentication-fetch-interceptors.test.ts` — with a selection set, the outgoing request has `X-Organization-Id`; **with no selection, the header is absent** (flag-off-equivalent: existing single-org callers unchanged).

**Suggested AI model**: Tier 2 — `claude-haiku-4-5` (iterate) / `gpt-5-mini` / `gemini-2.5-flash`. Small module + one interceptor against an existing precedent in the same file.

**Reusable skills**: none.

Acceptance: a unit test proves the header is injected iff a selection exists; full suite green; no component reads the store yet.

---

### Phase 2 — `useMyOrganizations` hook (`mine/`)

**Goal**: expose the caller's active memberships as the switcher's data source.

Changes:

1. New `@src/hooks/organizations/use-my-organizations.ts` wrapping `organizationsMineOptions()`,
   following the [use-my-calendars.ts](../src/hooks/calendars/use-my-calendars.ts) convention. Export
   `MY_ORGANIZATIONS_QUERY_KEY` (mutations that change membership invalidate it).
2. Return `{ memberships, isGated: memberships.length === 0, isMultiOrg: memberships.length > 1, … }`.

Spec use-case: shared scaffolding consumed by UC2/UC3/UC4 — no visible flow on its own.

Tests:

- **Unit**: `src/hooks/organizations/use-my-organizations.test.ts` — maps a bare-array response to `memberships`; `[]` ⇒ `isGated`; 2 entries ⇒ `isMultiOrg`. (Mock the generated options, per existing hook tests.)

**Suggested AI model**: Tier 2 — `claude-haiku-4-5` / `gpt-5-mini` / `gemini-2.5-flash`. Thin hook mirroring an established pattern verbatim.

**Reusable skills**: `new-hook` (wraps the generated `organizationsMine` query).

Acceptance: `useMyOrganizations()` returns the parsed membership array with `isGated`/`isMultiOrg` flags; unit tests green.

---

### Phase 3a — Active-org selection hook + bootstrap (UC1)

**Goal**: on app load, resolve the active selection and prime the header **before** tenant queries fire —
**without guessing** for multi-org users. Single-org callers auto-resolve; stale ids self-heal; multi-org
callers with no valid selection are left unset for the Phase 3b gate to handle. No new visible UI.

**Feature flag**: none (Guiding Decisions). Behavior change is the header being primed; off-equivalent
(no `mine/` data yet) leaves the store untouched.

Changes:

1. New `@src/hooks/organizations/use-active-organization.ts`: `useSyncExternalStore` over the store +
   `useMyOrganizations`. Computes `activeMembership`; exposes `setActive(id)` that calls
   `setActiveOrganizationId` **and** `queryClient.invalidateQueries()` (switch mechanics). Also exposes
   `needsSelection` = authenticated && `memberships.length > 1` && no valid stored id (drives the gate).
2. Bootstrap effect (in `useActiveOrganization` or a small `ActiveOrganizationProvider` mounted in
   [app-layout-client.tsx](../src/components/navigation/app-layout-client.tsx)): when `mine/` resolves —
   stale stored id (not in `mine/`) ⇒ `clearActiveOrganization`; **exactly one** membership and no valid
   id ⇒ `setActive` that org; **2+** and no valid id ⇒ leave unset (`needsSelection` true).
3. Ordering: selection resolves before tenant views fetch (gate the shell render on `useMyOrganizations`
   loaded, reusing the existing `LoadingView`).

Spec use-case: UC1 (single-org implicit resolution + selection bootstrap).

Tests:

- **Unit**: `src/hooks/organizations/use-active-organization.test.ts` — valid stored id kept; **single** membership + empty store ⇒ auto-set; **2+** + empty store ⇒ store stays empty and `needsSelection` true; stale id ⇒ cleared (then single/multi rule applies); `setActive` writes store + invalidates.
- **Integration**: a single-org user with no stored selection ends with the store populated and the next request carries the header; a 2-org user's store stays empty (no guess).

**Suggested AI model**: Tier 3 — `claude-sonnet-4-6` / `gpt-5` / `gemini-2.5-pro`. Cross-cutting: store + react-query + layout ordering + stale-selection healing + the no-guess branch.

**Reusable skills**: none.

Acceptance: single-org user auto-resolves and tenant requests carry the header; a multi-org user with no valid stored id leaves the store empty and reports `needsSelection`; stale ids self-heal.

---

### Phase 3b — Login-time org selection gate + auth page (UC1)

**Goal**: an authenticated multi-org user with no valid stored selection is forced to pick an org on an
auth-layout page before reaching the dashboard.

**Feature flag**: none.

Changes:

1. New route `@src/app/auth/select-organization/page.tsx` under the existing `AuthLayout` (mirror
   [onboarding/page.tsx](../src/app/auth/onboarding/page.tsx) chrome): lists `useMyOrganizations`
   memberships (org name + role) as selectable cards/buttons. Picking one calls `setActive(orgId)` then
   `router.replace('/')` (or the originally-requested path if preserved).
2. Gate in [app-layout-client.tsx](../src/components/navigation/app-layout-client.tsx): when
   `needsSelection` (from Phase 3a), `router.replace('/auth/select-organization')` via a dedicated effect
   — same pattern as the existing `isGated`/`isDisabled` redirects, and the route lives **outside**
   `(app)` so the layout doesn't re-run and loop. Render `LoadingView` while redirecting.
3. Guard the select page itself: 0 orgs ⇒ bounce to `/auth/onboarding`; exactly 1 org ⇒ auto-pick +
   continue (no dead-end); already-valid selection ⇒ straight to `/`.

Spec use-case: UC1 (mandatory multi-org selection at login).

Tests:

- **Unit**: `select-organization/page.test.tsx` — renders one option per membership; selecting calls `setActive` + redirects; 1-org ⇒ auto-continue; 0-org ⇒ onboarding redirect.
- **Integration**: a 2-org user with empty store hitting any `(app)` route is redirected to `/auth/select-organization`; after picking, lands on the dashboard with the header set.

**Suggested AI model**: Tier 3 — `claude-sonnet-4-6` / `gpt-5` / `gemini-2.5-pro`. New auth route + layout gate + redirect-loop care.

**Reusable skills**: `new-page` (the auth route).

Acceptance: a multi-org user with no valid stored selection cannot reach the dashboard without picking an org on `/auth/select-organization`; single-org and already-selected users never see it.

---

### Phase 4 — Sidebar org switcher dropdown (UC2)

**Goal**: a 2+-org user opens the sidebar org item and switches active org; the view refetches under the
new org.

**Feature flag**: none. Dropdown renders only when `isMultiOrg`; single-org users see the current
static label (unchanged).

Changes:

1. [app-sidebar.tsx](../src/components/layout/app-sidebar.tsx#L237-L270): wrap the org `<button>` in a
   `DropdownMenu` (already imported + used for the account menu lower in the same file). Menu lists each
   membership (org name + role), checkmark on the active one, divider, and a **"+ New organization"**
   item (wired in Phase 5). Pass memberships + active id + `onSelect` as props; keep the static
   single-org rendering when `!isMultiOrg`.
2. New composition `@src/components/organizations/org-switcher.tsx` (or inline in the sidebar if small):
   the dropdown content, consuming `useActiveOrganization`.
3. Selecting an org calls `setActive(id)` (store + invalidate-all from Phase 3).

Spec use-case: UC2 (multi-org switch).

Tests:

- **Unit**: `org-switcher.test.tsx` — renders one row per membership, checkmark on active, role label; selecting a row calls `setActive` with that org id.
- **Integration**: switching invalidates queries (spy on `queryClient.invalidateQueries`).

**Suggested AI model**: Tier 3 — `claude-sonnet-4-6` / `gpt-5` / `gemini-2.5-pro`. New interactive UI + cache-invalidation wiring.

**Reusable skills**: `new-composition` (org-switcher); `add-storybook-story` (switcher states).

Acceptance: a user with 2 orgs can switch active org from the sidebar; the active org persists across reload and tenant data refetches under it.

---

### Phase 5 — Create another organization from the switcher (UC3)

**Goal**: "+ New organization" in the switcher creates an org (caller becomes admin) and switches into it.

**Feature flag**: none.

Changes:

1. New `@src/components/organizations/create-organization-dialog.tsx` — shadcn `Dialog` + the same
   name form as [onboarding/page.tsx](../src/app/auth/onboarding/page.tsx#L70-L109) (react-hook-form +
   zod), reusing [use-create-organization.ts](../src/hooks/organizations/use-create-organization.ts).
2. On `201`: invalidate `MY_ORGANIZATIONS_QUERY_KEY` **and** `CURRENT_ORGANIZATION_QUERY_KEY`, then
   `setActive(newOrgId)`. Extend `useCreateOrganization` to also invalidate `mine/` (currently only
   invalidates current).
3. Wire the switcher's "+ New organization" item to open the dialog.

Spec use-case: UC3 (create-another-org).

Tests:

- **Unit**: `create-organization-dialog.test.tsx` — submit calls create with the name; validation blocks empty name.
- **Integration**: on success, `mine/` invalidated and `setActive` called with the new org id.

**Suggested AI model**: Tier 3 — `claude-sonnet-4-6` / `gpt-5` / `gemini-2.5-pro`. Dialog + mutation wiring + active-switch.

**Reusable skills**: `new-composition` (dialog); `add-storybook-story`.

Acceptance: creating an org from the switcher lands the user in it as admin with the org set active and `mine/` showing the new entry.

---

### Phase 6 — Gated onboarding drives off `mine/` (UC4a)

**Goal**: a user with 0 active memberships (`mine/` ⇒ `[]`) is routed to onboarding; creating a first org
sets it active and enters the app.

**Feature flag**: none.

Changes:

1. [app-layout-client.tsx](../src/components/navigation/app-layout-client.tsx#L141-L168): keep the
   existing `useCurrentOrganization` gating (404 ⇒ onboarding) but reconcile "gated" with
   `useMyOrganizations().isGated` (`[]`) as the authoritative empty-membership signal; ensure no
   double-redirect with the existing `isGated` effect.
2. [onboarding/page.tsx](../src/app/auth/onboarding/page.tsx): after `createOrganization`, `setActive`
   on the new org id (so the first tenant request carries the header) before `router.replace('/')`.

Spec use-case: UC4a (onboarding from zero via create).

Tests:

- **Unit**: onboarding submit calls create then `setActive` with the returned org id.
- **Integration**: a `mine/ ⇒ []` user is redirected to `/auth/onboarding` (no infinite redirect).

**Suggested AI model**: Tier 3 — `claude-sonnet-4-6` / `gpt-5` / `gemini-2.5-pro`. Gating reconciliation across two hooks + redirect-loop care.

**Reusable skills**: none.

Acceptance: a 0-org user can create a first org from onboarding, lands in the app with that org active, and is never bounced between onboarding and the app shell.

---

### Phase 7 — Accept invitation into an additional org (UC4b)

**Goal**: an already-onboarded user accepts an invite into org B, gaining a second membership; `mine/`
refreshes and the new org becomes active.

**Feature flag**: none.

Changes:

1. [use-accept-invitation.ts](../src/hooks/organizations/use-accept-invitation.ts): on success invalidate
   `MY_ORGANIZATIONS_QUERY_KEY` (in addition to `current/`) and `setActive` on the accepted org id.
   Handle `UserAlreadyHasMembershipError` (400) as "already a member of **this** org" (same-org
   duplicate), per the contract — surface a clear message, not a generic error.
2. Accept-invite entry point (existing `/auth/accept-invite` link from onboarding, and reachable while
   logged in): ensure it works for an authenticated user already in org A.

Spec use-case: UC4b (gain second membership via accept).

Tests:

- **Unit**: accept success invalidates `mine/` + `current/` and calls `setActive`; `UserAlreadyHasMembershipError` maps to the same-org-duplicate message.
- **Integration**: after accept, the switcher (Phase 4) shows 2 orgs with the accepted one active.

**Suggested AI model**: Tier 3 — `claude-sonnet-4-6` / `gpt-5` / `gemini-2.5-pro`. Multi-membership invalidation + error-mapping.

**Reusable skills**: none.

Acceptance: an onboarded user accepts an invite into a second org, `mine/` shows both, the accepted org is active, and a same-org re-accept shows a clear "already a member" message.

---

### Phase 8 — Recover from 400 (header required) (UC5)

**Goal**: if a tenant request returns `400 {"detail":"X-Organization-Id header required."}` (multi-org user
with no selection — a guard that should be near-unreachable after Phase 3), set a selection from `mine/`
and refetch instead of erroring.

**Feature flag**: none.

Changes:

1. New `@src/hooks/organizations/use-organization-error-recovery.ts` (or extend the query client's
   default error handling): detect the 400 detail, ensure `useMyOrganizations` is loaded, `setActive` to
   the first membership, and invalidate to retry. No interceptor changes (Guiding Decisions: UI-layer
   recovery).
2. A neutral toast (sonner, already in `src/components/ui/sonner.tsx`) only if recovery can't resolve
   (e.g. `mine/` is empty → fall through to onboarding).

Spec use-case: UC5 (400 header-required recovery).

Tests:

- **Unit**: a 400-with-that-detail triggers `setActive(firstOrg)` + invalidation; empty `mine/` routes to onboarding instead.
- **Integration**: simulated 400 on a calendars query recovers and the retried request carries the header.

**Suggested AI model**: Tier 2 — `claude-haiku-4-5` (iterate) / `gpt-5-mini` / `gemini-2.5-flash`. Focused error-detection + existing hooks; no new UI surface.

**Reusable skills**: none.

Acceptance: a forced 400 on a tenant request results in a selection being set and a successful retry; no hard error shown to the user.

---

### Phase 9 — Recover from 403 (stale active org) (UC6)

**Goal**: if a tenant request returns 403 because the active selection is stale/invalid (e.g. membership
deactivated), drop the selection, refetch `mine/`, re-pick a default, toast — without bouncing a still-
multi-org user to `/no-access`.

**Feature flag**: none.

Changes:

1. Extend the Phase 8 recovery hook: on a tenant-request 403, `clearActiveOrganization`, invalidate
   `MY_ORGANIZATIONS_QUERY_KEY`, and after refetch `setActive` to the first remaining membership; toast
   "That organization is no longer available — switched to <name>."
2. Differentiate from the existing `current/` 403 → `disabled` → `/no-access` path
   ([app-layout-client.tsx](../src/components/navigation/app-layout-client.tsx#L172-L176)): only fall
   through to `/no-access` when `mine/` is **empty** after refetch (genuinely no orgs left); otherwise
   re-pick. Document the distinction in the hook.

Spec use-case: UC6 (403 stale-selection recovery).

Tests:

- **Unit**: tenant 403 with non-empty `mine/` ⇒ clear + re-pick + toast; with empty `mine/` ⇒ existing disabled/no-access path.
- **Integration**: stale selection → 403 → recovers to a valid org and refetches; deactivated-everywhere → `/no-access`.

**Suggested AI model**: Tier 3 — `claude-sonnet-4-6` / `gpt-5` / `gemini-2.5-pro`. Branching recovery + reconciliation with existing disabled/no-access routing.

**Reusable skills**: none.

Acceptance: a stale active-org 403 recovers to a valid org with a toast for a multi-org user, and only routes to `/no-access` when the user truly has no remaining memberships.

---

## 6. Risk & Rollout Notes

- **No feature flag** (per decision). Mitigations: (a) phase order lands inert plumbing (Phase 1) before
  any consumer; (b) Phase 1's integration test asserts **no header when no selection** — single-org and
  pre-feature callers are byte-for-byte unchanged; (c) each phase independently reversible.
- **Cache invalidation on switch** uses `queryClient.invalidateQueries()` (all keys). Risk: a noisy
  refetch storm on switch. Acceptable given 5-min `staleTime` and that switching is rare + user-initiated.
  If it proves heavy, a follow-up can scope invalidation to tenant-prefixed keys.
- **StrictMode double-registration**: the interceptor module already guards with a `configured` flag
  ([line 20](../src/lib/authentication-fetch-interceptors.ts#L20)); the new request interceptor rides the
  same guard — don't add a second `configureClientAuthentication`.
- **SSR safety**: store + interceptor must guard `typeof window` (localStorage is browser-only), exactly
  like the existing `authClient` session interceptor — server renders must not throw.
- **Redirect loops**: Phases 6/9 touch the onboarding/no-access routing that already uses separate
  effects to avoid loops; preserve the "route lives outside `(app)`" invariant noted in
  [app-layout-client.tsx](../src/components/navigation/app-layout-client.tsx#L170-L176).
- **Rollback**: revert per phase. Reverting Phase 1 removes header injection (single-org users keep
  working via implicit resolution); reverting Phase 4 removes the switcher but leaves plumbing inert.
- **No backfill / no migration** — client-only feature.
- **E2E deliberately skipped** — the repo has no decent e2e setup yet (project decision). Every UI-flow
  phase ships **unit + integration** coverage instead (jsdom + Testing Library + mocked generated
  options). Revisit once an e2e harness lands; do **not** add Playwright specs as part of this plan.

## 7. Open Questions

| Question | Recommended default | Owner |
| --- | --- | --- |
| Should the active org be SSR-aware (cookie) so server components can scope data? | **No for v1** — client-only; revisit if a tenant-scoped server component appears. | Eng |
| Does any current tenant view fetch on the **server** (RSC) where the client interceptor won't run? | Audit during Phase 1; if found, that view needs the header threaded server-side (out of scope — raise then). | Eng |
| Invalidate-all vs scoped invalidation on switch | **Invalidate-all** now; scope later only if refetch cost shows up. | Eng |
| Should "+ New organization" also be reachable from a settings page (not just the switcher)? | **No** — switcher + onboarding only (Non-goal). | Product |

## 8. Touch List

**Phase 0** — *edit*: [schema.yml](../schema.yml); *regenerated*: `src/client/**` (`sdk.gen.ts`,
`types.gen.ts`, `@tanstack/react-query.gen.ts`); *reconcile*:
[use-current-organization.ts](../src/hooks/organizations/use-current-organization.ts),
[app-layout-client.tsx](../src/components/navigation/app-layout-client.tsx).

**Phase 1** — *new*: `@src/lib/active-organization.ts`, `@src/lib/active-organization.test.ts`,
`@src/lib/authentication-fetch-interceptors.test.ts`; *edit*:
[authentication-fetch-interceptors.ts](../src/lib/authentication-fetch-interceptors.ts).

**Phase 2** — *new*: `@src/hooks/organizations/use-my-organizations.ts`,
`@src/hooks/organizations/use-my-organizations.test.ts`.

**Phase 3a** — *new*: `@src/hooks/organizations/use-active-organization.ts`,
`@src/hooks/organizations/use-active-organization.test.ts`, (optional)
`@src/components/organizations/active-organization-provider.tsx`; *edit*:
[app-layout-client.tsx](../src/components/navigation/app-layout-client.tsx).

**Phase 3b** — *new*: `@src/app/auth/select-organization/page.tsx`,
`@src/app/auth/select-organization/page.test.tsx`; *edit*:
[app-layout-client.tsx](../src/components/navigation/app-layout-client.tsx).

**Phase 4** — *new*: `@src/components/organizations/org-switcher.tsx`,
`@src/components/organizations/org-switcher.stories.tsx`,
`@src/components/organizations/org-switcher.test.tsx`; *edit*:
[app-sidebar.tsx](../src/components/layout/app-sidebar.tsx).

**Phase 5** — *new*: `@src/components/organizations/create-organization-dialog.tsx`,
`@src/components/organizations/create-organization-dialog.stories.tsx`,
`@src/components/organizations/create-organization-dialog.test.tsx`; *edit*:
[use-create-organization.ts](../src/hooks/organizations/use-create-organization.ts),
`org-switcher.tsx`.

**Phase 6** — *edit*: [app-layout-client.tsx](../src/components/navigation/app-layout-client.tsx),
[onboarding/page.tsx](../src/app/auth/onboarding/page.tsx).

**Phase 7** — *edit*: [use-accept-invitation.ts](../src/hooks/organizations/use-accept-invitation.ts),
accept-invite page/component.

**Phase 8** — *new*: `@src/hooks/organizations/use-organization-error-recovery.ts`,
`@src/hooks/organizations/use-organization-error-recovery.test.ts`; *edit*: query client provider or
recovery mount point.

**Phase 9** — *edit*: `use-organization-error-recovery.ts` (+ test),
[app-layout-client.tsx](../src/components/navigation/app-layout-client.tsx).
