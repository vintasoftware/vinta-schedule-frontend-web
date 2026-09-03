# Billing Hardening Gap Closure — Implementation Plan

> Closes the genuine gaps between the **shipped** billing frontend (built on the pre-hardening `2026-08-09-BILLING_FRONTEND` contract, merged to `origin/main` via PRs #103–#110) and the **hardened** [2026-08-11 billing spec](2026-08-11-BILLING_PLANS_AND_LIMITS_FRONTEND_SPEC.md). This is a follow-on to that spec, not a rebuild — the billing area already exists and works against the old contract. Requirements come from the gap analysis recorded alongside this plan; read the 2026-08-11 spec for the full intended behavior. **All phases branch off `origin/main`** (where the billing feature lives), not the current working branch.
>
> **2026-08-17 update — rebased onto `origin/main` after PR #113 (`membership role → permissions capability model`) merged.** That PR (1) **regenerated the whole client** from a schema that already carries the billing hardening, so `main` now has `billingSubscriptionRetryPaymentCreate`, `BillingProfileDocumentTypeEnum`, and the `document_type` cast — **Phase 0 is therefore removed as redundant** (see the Phase 0 note below); and (2) **replaced role gating with a capability model** — `role-gate.tsx` → `permission-gate.tsx`, plus `src/lib/permissions.ts`. Every "admin"/`useRole()` reference in this plan now means `useHasPermission(PERMISSIONS.manageBilling)` (the `payments.manage_billing` capability). Phase numbers are kept stable (0 stays as a removed marker) so the already-open PRs keep their phase labels.

## 1. Goals

1. Bring the shipped billing frontend up to the hardened contract: consume the new `retry-payment` endpoint, the nine-value `document_type` enum, and the full stable error-`code` set, replacing the workarounds the shipped code adopted when those did not exist.
2. Close the read-surface gaps so the billing views show what the spec requires: an app-wide grace/restricted banner, the subscription interval and pending plan change, currency-filtered plans with limits/entitlements, and a correct "not included" state for zero-limit resources.
3. Make over-limit rejections route to a remedy on **every** user-reachable guarded write through one global handler, with the remedy derived on the client from `resource` + `billing_state` (the contract carries no `remedy` field).
4. Preserve everything the shipped billing feature already does correctly — nav, ledger/history, add-on purchase/stop, Stripe tokenization, subscription reads — touching those paths only where a named gap requires it.

**Non-goals:**
- Rebuilding any already-shipped, already-correct billing surface (nav via `app-sidebar.tsx`, usage-ledger/history with its admin gate, add-on purchase/stop, Stripe tokenization, subscription 404→empty-state).
- Completing the MercadoPago adapter. MercadoPago becomes a clean "not available" outcome; the Stripe path is the only working one (matches the 2026-08-11 spec's Stripe-only decision).
- Adding a feature-flag framework (none exists in the repo; the shipped billing feature merged flagless).
- A standalone "manage saved card while active" surface, formal invoice/receipt documents, reseller/child-org billing, or GraphQL error handling — all out of scope in the 2026-08-11 spec and unchanged here.
- Backend changes. The hardened contract is deployed and serving; this plan consumes it. Adding a server `remedy` field is explicitly declined in favor of client derivation.
- Playwright e2e — unit + integration only; e2e can be added per-flow later via `add-e2e-test`.

## 2. Guiding Decisions

| Decision | Resolution |
|---|---|
| **Base branch = `origin/main`** | The billing feature is merged there (PRs #103–#110). The current working branch is 52 commits behind and has no billing code. Every phase branches off `origin/main` so it stacks on the real, shipped billing surface. |
| **Hardened backend is live** | Confirmed with the requester: the `retry-payment` endpoint, `document_type` enum, and stable codes are deployed and serving. Group B is therefore buildable and testable against real responses, and the Phase 0 client regen reflects a real API — no "blocked until backend ships" gating needed. |
| **~~Phase 0 regenerates the client~~ — REMOVED** | Originally the shipped client lacked `retry-payment` and `BillingProfileDocumentTypeEnum`, so Phase 0 regenerated it. PR #113 (merged 2026-08-17) already regenerated the client from a schema that carries the billing hardening, so `main` now has both. Phase 0 is dropped; every hardening-dependent phase consumes the client already on `main`. |
| **Gating uses the capability model** | PR #113 replaced `useRole() === 'admin'` with `useHasPermission(PERMISSIONS.manageBilling)` (the `payments.manage_billing` capability) and deleted `role-gate.tsx` in favor of `permission-gate.tsx`. Tests provide it with `<PermissionProvider permissions={['payments.manage_billing']}>`. Any phase that gates a billing write reads the capability, not a role. |
| **Branch on stable `code`, never `detail`** | Now that stable codes are guaranteed, the two shipped readers that fall back to substring-matching `detail`/`message` (`isPaymentTokenRequiredError`, `isAddOnNotPurchasableError` in [api-errors.ts](../src/lib/utils/api-errors.ts)) are corrected to branch on `code` only. A single hardened discrimination layer is the one place codes are read. |
| **`remedy` is derived client-side** | The contract has no `remedy` field (0 occurrences in the hardened schema). The frontend computes it from `resource` + `billing_state` + whether the resource is add-on-purchasable, via a documented `deriveRemedy` table (see Data Model Changes). No backend dependency; the routing works against today's contract. The mapping is tunable and flagged in Open Questions for product validation. |
| **One global `MutationCache.onError`** | Over-limit routing is wired once on the shared QueryClient rather than per call-site, so every guarded write (invitations, calendars, groups, webhooks, bookings, system users) is covered without editing each hook. It no-ops on any non-`limit_exceeded` error; a pass-through regression test proves non-billing mutation errors are untouched. Landed last so all remedy destinations already exist. |
| **`document_type` closed on write, open on read** | The write control is a select constrained to the nine regenerated `BillingProfileDocumentTypeEnum` values; the read model treats the field as an open string so a legacy/out-of-enum value never breaks the screen. |
| **No feature flag** | The repo has no flag framework and the shipped billing feature merged without one. The only shared-path change (the global mutation handler) branches solely on `limit_exceeded` and passes every other error through unchanged, covered by a pass-through test. Rollback = revert the phase PR. No flag ⇒ no flag-removal phase. |
| **Phase granularity: bundled by cohesive area** | The gaps are individually small and cluster by area (read views, recovery flow, over-limit system). Related gaps share a phase where they stay MR-sized (≤1500 LoC), one concern, independently mergeable, with their own tests — matching how the shipped billing plan was structured. |
| **No e2e in this plan** | Unit + integration (Vitest + Testing Library) only. |

## 3. Data Model Changes

No backend models change. Client-side type plumbing only; the Phase 0 regen brings the hardened operations and schemas into `@src/client`.

### 3.1 Regenerated client surface (Phase 0)
- New operation `billing_subscription_retry_payment_create` → consumed by the recovery flow (Phase 7).
- New enum `BillingProfileDocumentTypeEnum` (nine values) on `BillingProfileWritable.document_type` → consumed by the profile form (Phase 4).
- Any new/renamed fields the regen surfaces (e.g. richer error bodies). Phase 0 fixes any hand-authored consumer that stops typechecking, exactly as the shipped Phase 0 handled the `KindEnum`/`WeekStartEnum` renames.

### 3.2 Hardened billing error discrimination (Phase 1)
Extend [api-errors.ts](../src/lib/utils/api-errors.ts) so every hardened code has a code-only reader (no `detail`/message fallback):
- Recognized set: `limit_exceeded`, `charge_declined`, `payment_token_required`, `unconfirmed_plan_change`, `payment_provider_not_configured`, `add_on_not_purchasable`, `retry_payment_not_applicable`, `subscription_not_attached`, `no_outstanding_balance`, `collection_not_supported`.
- Field-validation 400s (no `code`) parse to a field-keyed shape consumed by forms (Phase 4).
- The two 402 codes (`limit_exceeded`, `charge_declined`) are told apart by `code`, never status.

### 3.3 Client-derived remedy (Phase 8)
```ts
type Remedy = 'purchase_add_on' | 'upgrade_plan' | 'add_payment_method' | 'resolve_billing';

// deriveRemedy(resource, billingState, isAddOnPurchasable) — documented default:
//   billingState === 'grace' | 'restricted'      → 'resolve_billing'
//   else isAddOnPurchasable(resource) === true    → 'purchase_add_on'
//   else                                          → 'upgrade_plan'
//   ('add_payment_method' is reached via payment_token_required on the target flow,
//    not from an over-limit rejection.)
type RemedyRoute = { remedy: Remedy; href: string; resource?: ResourceKey };
```
Plus a `remedy → destination` map: `purchase_add_on` → add-on dialog pre-filled with `resource`; `upgrade_plan` → `/billing/plans?resource=…`; `resolve_billing` → `/billing/resolve-payment`; `add_payment_method` → card capture on the target flow.

## 4. API Design

No endpoints authored here. Consumed operations already exist in the hardened contract; Phase 0 brings them into the generated client. New consumption this plan adds: `billing_subscription_retry_payment_create` (Phase 7). Error contract consumed: the full ten-code set (Phases 1, 7, 8) plus field-validation 400s (Phase 4).

## 5. Phased Rollout

Order: ~~regen~~ → error discrimination (consumed by recovery + remedy) → read-surface polish → profile → downgrade distinction → provider fallback → grace recovery (real endpoint) → global over-limit handler last (all remedy destinations exist, routing deep-links precisely).

### Phase 0 — Schema refresh + client regeneration — **REMOVED (superseded by PR #113)**

**Not executed.** PR #113 (merged 2026-08-17) already regenerated the hey-api client from a schema that carries the billing hardening. `main` now has `billingSubscriptionRetryPaymentCreate` (in `sdk.gen.ts` + `@tanstack/react-query.gen.ts`), the full `BillingProfileDocumentTypeEnum`, and the `document_type` cast in `billing-profile-form.tsx`. Regenerating again would only re-conflict the client with `main`. The initial run opened PR #112 for this phase; that PR is closed as redundant. Phase 1 onward branch off `origin/main` directly.

### Phase 1 — Hardened billing error-code discrimination

**Goal**: every billing error is discriminated by its stable `code`, with the ten-code set recognized and the two substring-matching readers corrected. Ship value: correct, specific error messages where the shipped code showed generic ones; foundation for Phases 7–8.

**Feature flag**: none — hardens an existing shared util; existing callers keep working (the codes they read are unchanged), new codes gain readers.

Changes:
1. [api-errors.ts](../src/lib/utils/api-errors.ts): add code-only readers for the seven currently-unhandled codes (`charge_declined`, `unconfirmed_plan_change`, `payment_provider_not_configured`, `retry_payment_not_applicable`, `subscription_not_attached`, `no_outstanding_balance`, `collection_not_supported`); keep `limit_exceeded`/`payment_token_required`/`add_on_not_purchasable`.
2. Remove the `detail`/`message` substring fallbacks from `isPaymentTokenRequiredError` and `isAddOnNotPurchasableError` — branch on `code` only, now that stable codes are guaranteed.
3. Add a field-validation reader (no `code` → field-keyed map) for Phase 4.
4. Keep `readOverLimitError` and `billingUpgradePath` but ensure `readOverLimitError` exposes `resource` for remedy derivation (Phase 8).

Spec use-case: cross-cutting — backs the error handling in every write phase and the global handler.

Tests:
- **Unit**: `api-errors.test.ts` — each of the ten codes parses to its reader; an unknown code falls through safely; a `detail` that mentions "required"/"not purchasable" but carries a different (or no) `code` is NOT misclassified (the regression the substring fallback caused); a field-validation 400 parses to the field map.

**Suggested AI model**: Tier 2 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). Pure discrimination against established patterns in one util file.

**Reusable skills**: none.

Acceptance: all ten codes are discriminated by `code` alone, no reader branches on `detail`/message text, and a mislabeled-`detail` body no longer misclassifies — proven by unit tests.

### Phase 2 — Billing read-surface polish

**Goal**: the billing read views show the interval and pending plan change, currency-filtered plans with limits/entitlements, and a correct "not included" state for zero-limit resources.

**Feature flag**: none — edits to existing billing read components under the billing section.

Changes:
1. [billing-overview.tsx](../src/components/billing/billing-overview.tsx) / [plan-summary-card.tsx](../src/components/billing/plan-summary-card.tsx): pass the `Subscription` object in and render `billing_interval` and a "plan changes to {pending_plan_slug} on {pending_plan_effective_at}" line when a change is pending.
2. [billing-plans-picker.tsx](../src/components/billing/billing-plans-picker.tsx): default `useBillingPlans({ currency })` to the subscription currency; render each plan card's `limits` + `entitlements` (currently fetched but unused).
3. [resource-usage-row.tsx](../src/components/billing/resource-usage-row.tsx): add an explicit `limit_value === 0` → "not included" branch before the unlimited/ratio split (today a zero limit renders a live `0/0` bar).

Spec use-case: "Admin views plans" (read portion) + "Any member views current usage" + subscription view.

Tests:
- **Unit**: `plan-summary-card.test.tsx` — interval label; pending-change line shown only when `pending_plan_slug` set. `resource-usage-row.test.tsx` — `limit_value: 0` → not-included (no bar), `null` → ∞, positive → ratio.
- **Integration**: `billing-plans-picker.test.tsx` — plans filtered to subscription currency; limits/entitlements rendered per card.

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). Several coordinated component edits with currency/interval logic.

**Reusable skills**: `new-composition` (only if a card is restructured; otherwise none).

Acceptance: the overview shows interval + pending change, the plans catalog is currency-filtered and shows limits/entitlements, and a zero-limit resource renders "not included" rather than a `0/0` bar.

### Phase 3 — App-wide billing-state banner

**Goal**: a restricted or grace org sees the billing-state banner on every page, not only inside `/billing`.

**Feature flag**: none — additive mount in the app shell; renders nothing in `free`/`active`.

Changes:
1. Mount [billing-state-banner.tsx](../src/components/billing/billing-state-banner.tsx) in the app shell ([app-layout-client.tsx](../src/components/navigation/app-layout-client.tsx) / the layout that wraps every authenticated page) driven by a lightweight org-wide `billing_state` read, independent of the `/billing` route.
2. Remove the now-redundant in-section mount at [billing-overview.tsx](../src/components/billing/billing-overview.tsx) (or keep a single source of truth) so the banner is not double-rendered on `/billing`.
3. Keep the existing grace/restricted/hidden config and the "Resolve payment" link to `/billing/resolve-payment`.

Spec use-case: billing-state banner (Acceptance scenario "Restricted — writes blocked, reads open").

Tests:
- **Unit**: banner hidden in `free`/`active`, informational in `grace`, prominent in `restricted`.
- **Integration**: `app-layout-client.test.tsx` — banner renders on a non-billing route (e.g. dashboard) for a restricted org; not double-rendered on `/billing`.

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). App-shell wiring across the layout with an org-wide read.

**Reusable skills**: none.

Acceptance: a restricted org shows the banner on `/dashboard` (and every authenticated page), with a working "Resolve payment" link, and it appears exactly once on `/billing`.

### Phase 4 — Billing profile form hardening

**Goal**: `document_type` is a select constrained to the nine enum values on write while tolerating a legacy value on read, and server field-validation 400s surface per field.

**Feature flag**: none — edits to the existing profile form; the endpoints already enforce admin-only writes server-side.

Changes:
1. [billing-profile-form.tsx](../src/components/billing/billing-profile-form.tsx): replace the free-text `document_type` `Input` with a select bound to the regenerated `BillingProfileDocumentTypeEnum`; the read model renders an out-of-enum legacy value without breaking.
2. Wire field-validation 400s through the Phase 1 field-validation reader → `form.setError` per field (today any non-409 error shows a single generic message because the generated client throws the raw body, not an `Error`).
3. Keep the existing create/update-by-404 and 409-conflict handling. Gate the write on the `payments.manage_billing` capability (`useHasPermission(PERMISSIONS.manageBilling)`, per the capability decision above — not `useRole()`); give the defensive 403 its own clear "you need billing permission" message instead of the generic fallback.

Spec use-case: "Admin creates the billing profile" + "Non-admin member tries to edit the billing profile".

Tests:
- **Unit**: document-type select offers exactly the nine values; a legacy read value renders; required-field validation blocks submit.
- **Integration**: a server field-error 400 maps to the right field; a defensive 403 shows the admin-only message and writes nothing.

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). Form with enum/read asymmetry + per-field server-error mapping.

**Reusable skills**: none (edits an existing composition).

Acceptance: a document type outside the enum is blocked on write while a legacy value still displays on read, and a server field error lands on its field rather than a generic message.

### Phase 5 — Downgrade-vs-upgrade distinction

**Goal**: a scheduled downgrade shows its effective date instead of polling like an upgrade and mislanding on "still confirming… taking longer than usual".

**Feature flag**: none — corrects behavior inside the existing change-plan dialog.

Changes:
1. [change-plan-dialog.tsx](../src/components/billing/change-plan-dialog.tsx): distinguish a downgrade (effective at `pending_plan_effective_at`, no webhook confirmation) from an upgrade (polled until `pending_plan_slug` clears). A downgrade shows "scheduled for {pending_plan_effective_at}" and does not enter the payment-confirmation poll.
2. [billing-plans-picker.tsx](../src/components/billing/billing-plans-picker.tsx): label the action by direction where the target vs current plan implies a downgrade.

Spec use-case: "Admin views plans and changes plan" (change portion).

Tests:
- **Unit**: `change-plan-dialog.test.tsx` — upgrade shows pending + polls to effective; downgrade shows the scheduled date and skips the poll (never reaches the "taking longer" state).

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). Branching an async flow on plan direction with distinct terminal states.

**Reusable skills**: none.

Acceptance: a downgrade shows its scheduled effective date and never enters the payment-confirmation poll, while an upgrade still polls to effect.

### Phase 6 — Payment-provider unsupported fallback

**Goal**: a non-Stripe (e.g. MercadoPago) resolved provider shows a clear "not available" message instead of a broken card form that can never tokenize.

**Feature flag**: none — replaces a broken adapter path with a clean outcome; Stripe unchanged.

Changes:
1. [payment-provider-sdk.ts](../src/lib/billing/payment-provider-sdk.ts): replace the unverified, always-failing MercadoPago Secure-Fields adapter with a typed "provider not supported" outcome the capture UI renders as a clear message. Keep the provider-agnostic interface and the working Stripe adapter.
2. Ensure the capture components ([payment-instrument-field.tsx](../src/components/billing/payment-instrument-field.tsx)) render the "not available" state cleanly rather than mounting a dead form.

Spec use-case: Payment provider & credentials decision (Stripe-only).

Tests:
- **Unit**: the factory returns the Stripe adapter for `stripe` and the "not supported" outcome for `mercadopago`/unknown; the capture field renders the clear message for the unsupported outcome.

**Suggested AI model**: Tier 2 for the SDK factory change; Tier 3 if the capture UI needs restructuring. IDs per tier in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml).

**Reusable skills**: none.

Acceptance: a MercadoPago-resolved org sees a clear "card payment not available" message, and the Stripe path is unchanged.

### Phase 7 — Grace recovery via the real retry-payment endpoint

**Goal**: the recovery flow uses the dedicated `retry-payment` endpoint, handles `charge_declined` as "try another card", messages each 409 case, and mints a new idempotency key for a genuinely new card.

**Feature flag**: none — reroutes the existing recovery form to the correct endpoint.

Changes:
1. Add a `use-retry-payment` hook wrapping `billing_subscription_retry_payment_create`; one idempotency key held across retries of the same attempt, a **new** key for a genuinely new card.
2. [resolve-payment-form.tsx](../src/components/billing/resolve-payment-form.tsx): submit to retry-payment instead of the `change-plan` workaround; show pending and poll `useSubscription` until `active` (never "success" off the 2xx). On `charge_declined` (402, told apart from `limit_exceeded` by `code`) re-prompt for a different card, refetch the subscription, and reset the idempotency key.
3. Coded handling via Phase 1: `retry_payment_not_applicable` / `no_outstanding_balance` / `collection_not_supported` each a distinct message; `subscription_not_attached` routes to the first-payment/upgrade flow.
4. Fix the idempotency-reset gap: the persistent recovery page must call `.reset()` (or force a fresh key) on a new-card attempt — [idempotency.ts](../src/lib/billing/idempotency.ts) `reset()` exists but is never invoked here today.

Spec use-case: "Admin recovers a subscription in grace with a dead card".

Tests:
- **Unit**: `resolve-payment-form.test.tsx` — 2xx shows pending (not success) + polls to active; `charge_declined` re-prompts with a fresh key + refetch; each 409 code its own message.
- **Integration**: `subscription_not_attached` routes to first-payment; idempotency key reused across a same-attempt retry, new key on a new card (double-charge guard).

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). Async polling + coded-error branching + idempotency-key lifecycle.

**Review models**: reviewer Tier 4 — the idempotency-key lifecycle here is the one place a bug **double-charges a real user**; the independent review runs on the most capable model. Fixer left on the project default.

**Reusable skills**: `new-hook` (`use-retry-payment`).

Acceptance: submitting a new card in grace hits retry-payment, shows pending, and reports active only after the subscription flips; a declined card re-prompts with a fresh idempotency key; each non-applicable case shows its distinct message.

### Phase 8 — Global over-limit handler + client-derived remedy routing

**Goal**: every user-reachable guarded write that returns `limit_exceeded` restores the pre-submit UI and routes to the matching remedy destination, with the remedy derived on the client.

**Feature flag**: none — see Guiding Decisions. The handler branches only on `limit_exceeded` and passes every other error through unchanged; a pass-through test asserts existing mutations are unaffected.

Changes:
1. Add a global `MutationCache.onError` to the shared QueryClient in [query-client-provider.tsx](../src/components/query-client-provider.tsx) that runs the Phase 1 discrimination and, on `limit_exceeded`, derives the remedy (`deriveRemedy(resource, billing_state, isAddOnPurchasable)`) and dispatches routing. Non-billing errors are untouched (existing per-query `QueryCache.onError` org-recovery stays).
2. New remedy-router (+ small controller): `purchase_add_on` → add-on dialog pre-filled with `resource`; `upgrade_plan` → `/billing/plans?resource=…`; `resolve_billing` → `/billing/resolve-payment`; `add_payment_method` → card capture on the target flow. Unknown remedy → generic "manage billing" fallback.
3. Fix the dead deep-link: [plans/page.tsx](../src/app/\(app\)/billing/plans/page.tsx) reads the `?resource=` param and highlights/filters to the relevant plans (today the param is ignored).
4. Confirm the guarded creation flows surface the rollback cleanly across the enumerated surfaces (invitations create/resend/accept — which `schema.yml` documents with 402 seat-limits today — resource/bundle calendars, calendar groups, availability windows, webhook configs, system users, event/booking creation). Retire or fold the calendar-groups-only `OverLimitAlert` into the shared path where it overlaps. **Note (post-#113):** `team-table.tsx`, the calendar-groups surfaces, and `app-layout-client.tsx` were reworked by the capability migration; re-confirm the guarded-write and permission call sites against their current shape, and gate any admin-only affordance on `useHasPermission(PERMISSIONS.manageBilling)`.

Spec use-case: "Member hits a capacity ceiling while creating a resource".

Tests:
- **Unit**: `deriveRemedy` returns the documented remedy for each `(resource, billing_state)` combination; `remedy-router` routes each remedy to the right destination with resource context; unknown remedy → fallback.
- **Integration**: a simulated `limit_exceeded` on a representative guarded mutation (e.g. create invitation) restores UI and routes by remedy; `/billing/plans?resource=…` acts on the param; a **pass-through** test asserts a non-billing mutation error is handled exactly as before (no regression).

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). Touches the shared QueryClient and coordinates routing across all billing destinations.

**Review models**: reviewer Tier 4 — this is the only change that touches the shared mutation path used by every existing write; the independent review verifies non-billing errors are provably untouched. Fixer left on the project default.

**Reusable skills**: `new-composition` (remedy-router).

Acceptance: a guarded write returning `limit_exceeded` restores the pre-submit UI and routes to the correct client-derived remedy for all guarded surfaces, `/billing/plans` acts on `?resource=`, and a non-billing mutation error behaves identically to before (proven by a pass-through test).

## 6. Risk & Rollout Notes

- **No feature flag / no kill switch.** The only shared-path change is Phase 8's global `MutationCache.onError`, which acts only on `limit_exceeded` and passes all other errors through. Mitigation: the Phase 8 pass-through regression test; the change is a small, revertible diff on one provider file. Rollback = revert the Phase 8 PR.
- **Client regen is not purely additive.** Phase 0 may surface renamed/removed symbols (as the shipped Phase 0 did with `KindEnum`/`WeekStartEnum`). Mitigation: verify the exported-symbol surface against `origin/main` and typecheck the whole tree before merge; fix consumers in the same phase.
- **Double-charge via idempotency (recovery).** Phase 7 must mint a new key only for a genuinely new card and hold it across same-attempt retries. Covered by tests; Phase 7 review runs on Tier 4.
- **Client-derived remedy is a heuristic.** The `deriveRemedy` mapping is a frontend default, not a server truth. If product wants different routing, it changes one table. Flagged in Open Questions.
- **Async confirmation may lag/hang.** Upgrades, add-ons, and retry-payment poll until state changes; keep the existing bounded "still processing — check back" terminal state so the UI never spins forever (Phase 5 fixes the downgrade mislanding into that state).
- **Base branch drift.** All phases branch off `origin/main`; the current working branch is 52 commits behind and must not be the base. Rebase the stack on `origin/main` if it advances mid-implementation.
- **No migrations, no backfill, no locks** — frontend-only.

## 7. Open Questions

1. **`deriveRemedy` mapping.** The default (`grace`/`restricted` → resolve_billing; add-on-purchasable → purchase_add_on; else upgrade_plan) is a frontend heuristic. Recommended default: ship it as written, revisit with product once real over-limit traffic exists. Owner: product + billing frontend. The client derivation means no backend change is needed to retune it.
2. **Polling cadence / timeout and ledger page sizes.** Unchanged from the shipped implementation; not fixed by the backend. Recommended default: keep the shipped bounded-poll behavior. Owner: implementing team.
3. **`OverLimitAlert` retirement.** Whether to fully retire the calendar-groups-only `OverLimitAlert` once the global handler covers its surface, or keep it as an inline affordance. Recommended default: fold it into the shared path in Phase 8 where it overlaps; keep only if it provides inline UX the global handler can't. Owner: implementing team during Phase 8.

## 8. Touch List

**Phase 0 — regen — REMOVED** (client already regenerated on `main` by PR #113; nothing to touch).

**Phase 1 — error discrimination**
- Edit: [api-errors.ts](../src/lib/utils/api-errors.ts) (+ `api-errors.test.ts`)

**Phase 2 — read-surface polish**
- Edit: [billing-overview.tsx](../src/components/billing/billing-overview.tsx), [plan-summary-card.tsx](../src/components/billing/plan-summary-card.tsx), [billing-plans-picker.tsx](../src/components/billing/billing-plans-picker.tsx), [resource-usage-row.tsx](../src/components/billing/resource-usage-row.tsx) (+ tests)

**Phase 3 — app-wide banner**
- Edit: [app-layout-client.tsx](../src/components/navigation/app-layout-client.tsx), [billing-overview.tsx](../src/components/billing/billing-overview.tsx) (remove redundant mount), [billing-state-banner.tsx](../src/components/billing/billing-state-banner.tsx) (+ tests)

**Phase 4 — profile form**
- Edit: [billing-profile-form.tsx](../src/components/billing/billing-profile-form.tsx) (+ test)

**Phase 5 — downgrade distinction**
- Edit: [change-plan-dialog.tsx](../src/components/billing/change-plan-dialog.tsx), [billing-plans-picker.tsx](../src/components/billing/billing-plans-picker.tsx) (+ tests)

**Phase 6 — provider fallback**
- Edit: [payment-provider-sdk.ts](../src/lib/billing/payment-provider-sdk.ts), [payment-instrument-field.tsx](../src/components/billing/payment-instrument-field.tsx) (+ tests)

**Phase 7 — grace recovery**
- Create: `@src/hooks/billing/use-retry-payment.ts` (+ test)
- Edit: [resolve-payment-form.tsx](../src/components/billing/resolve-payment-form.tsx), [idempotency.ts](../src/lib/billing/idempotency.ts) usage (+ tests)

**Phase 8 — global over-limit handler + remedy routing**
- Create: `@src/lib/billing/derive-remedy.ts`, `@src/components/billing/remedy-router.tsx` (+ tests)
- Edit: [query-client-provider.tsx](../src/components/query-client-provider.tsx) (global `MutationCache.onError`), [plans/page.tsx](../src/app/\(app\)/billing/plans/page.tsx) (`?resource=`), [api-errors.ts](../src/lib/utils/api-errors.ts) (expose `resource` if not already), calendar-groups `OverLimitAlert` call sites (fold into shared path)
