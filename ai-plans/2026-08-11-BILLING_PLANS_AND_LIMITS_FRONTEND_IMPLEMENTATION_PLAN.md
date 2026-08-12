# Billing Plans and Limits (Frontend) — Implementation Plan

> Translates [2026-08-11-BILLING_PLANS_AND_LIMITS_FRONTEND_SPEC.md](2026-08-11-BILLING_PLANS_AND_LIMITS_FRONTEND_SPEC.md) into phased delivery. Read the spec first — this plan does not re-derive requirements. Frontend-only: the app is a REST/OpenAPI client (hey-api + TanStack Query, no GraphQL data layer); the backend contract is already merged and the generated client under `@src/client` already reflects it.

## 1. Goals

1. Build a new top-level **Billing** area (profile, plans, subscription, current usage, usage ledger) adopting the new billing contract correctly from day one, visible to all members with admin-only writes and admin-only ledger drill-in.
2. Handle every billing error by its stable machine-readable `code` (never message text), and route each over-limit (`limit_exceeded`) rejection on every user-reachable guarded write to the matching remedy — verified by tests even though it cannot fire in production yet.
3. Ship the full self-serve lifecycle for admins: change plan (upgrade/downgrade), cancel, purchase/stop add-ons, and recover a grace/restricted subscription via `retry-payment`, including Stripe card capture, with asynchronous provider confirmation reflected by polling.
4. Preserve existing behavior for multi-organization and non-admin users — billing requests inherit the existing active-organization context, and role gating reuses the existing role primitives.

**Non-goals:**
- MercadoPago card capture / collection (no account exists; only the Stripe path is built — the provider is read at runtime so MercadoPago is a later additive follow-up).
- A standalone "manage saved card while active" surface (no backing endpoint; card capture exists only inside first-payment and retry-payment flows).
- Formal invoice / receipt documents (no endpoint; the usage ledger is the reconciliation surface).
- Reseller / child-organization billing management UI.
- Any GraphQL error handling (the guarded operations are REST in this app).
- Rebuilding the active-organization store, the `X-Organization-Id` interceptor, or the role/RoleGate primitives — this feature consumes them.
- Backfilling / normalizing legacy `document_type` values.

## 2. Guiding Decisions

| Decision | Resolution |
|---|---|
| **No feature flag** | Chosen by the requester, and consistent with reality: the repo has **no feature-flag framework** (confirmed by grep), matching the backend's own "no flag framework" note. The only change touching existing flows is the global mutation-error handler (Phase 10), which branches **only** on billing error codes that cannot occur in production today (all orgs unlimited → `limit_exceeded` is inert; `charge_declined` only arises from a billing write this feature introduces). Regression surface on existing mutations is therefore near-zero, and it is covered by a pass-through test asserting non-billing errors are untouched. No flag ⇒ no flag-removal phase. |
| **Branch on `code`, never `detail`** | Billing errors share `BillingErrorBody { code, detail }`; `code` is stable/snake_case, `detail` is display/log-only English. The two `402` codes (`limit_exceeded`, `charge_declined`) are told apart by `code`, not status. Field-validation errors carry **no** `code` and are handled as form-field errors. A single parsing layer (Phase 1) is the one place that discriminates these shapes. |
| **Global mutation-error handler for over-limit** | Remedy routing is wired once as a global `MutationCache.onError` on the shared QueryClient rather than per-hook, so every guarded write is covered without editing each creation hook. It no-ops on any non-`limit_exceeded` error. Landed last (Phase 10) so all four remedy destinations already exist and routing deep-links precisely. |
| **`document_type` closed on write, open on read** | Write control constrained to the nine `BillingProfileDocumentTypeEnum` values; the read model treats it as an open string (legacy rows were not backfilled) so a legacy value never breaks the screen. |
| **Stripe-only card capture, provider read at runtime** | The provider + browser-safe publishable key come from `GET /billing/payment-provider/` (unauthenticated sibling `/default/`). A thin provider-agnostic capture interface is implemented for Stripe only; an unknown/unsupported provider surfaces a clear message. |
| **Async writes confirmed by polling** | Upgrades, add-on purchases, and retry-payment are **not** effective on their 2xx response (webhook-driven). The UI shows a pending state and polls `retrieve_subscription` / usage until `plan.slug` flips or the add-on activates, with a bounded "still processing — check back" terminal state. |
| **Idempotency key per intent, held across retries** | One client-generated key per user intent, reused on automatic retries of the same submission (provider collapses to one charge); a genuinely new attempt (e.g. a second card after decline) mints a new key. Prevents double-charge on retry-payment. |
| **Billing placement** | New top-level **Billing** nav group in `buildNavGroups`, visible to all members; admin-only actions and the ledger drill-in gated by the existing `RoleGate`. Grace/restricted banner is app-global. |
| **Phase granularity** | Grouped by cohesive area (requester choice): a foundation parsing phase, cohesive read-only view phases, then one phase per transactional/payment flow. Each phase stays MR-sized (≤1500 LoC), one concern, independently mergeable, own tests. |
| **No e2e in this plan** | Unit + integration (Vitest + Testing Library) only; e2e can be added per-flow later via `add-e2e-test`. |

## 3. Data Model Changes

No backend models change. Client-side type plumbing only; the generated client under `@src/client` already carries the billing operations and schemas.

### 3.1 Billing error types (Phase 1)
A hand-written module discriminating the three billing error shapes off the generated `BillingErrorBody` / limit-exceeded schema:
- `LimitExceededError` — `{ code: 'limit_exceeded', resource, current_usage, limit, remedy }`.
- `CodedBillingError` — `{ code, detail }` for the coded set (`payment_token_required`, `unconfirmed_plan_change`, `payment_provider_not_configured`, `add_on_not_purchasable`, `retry_payment_not_applicable`, `subscription_not_attached`, `no_outstanding_balance`, `collection_not_supported`, `charge_declined`).
- `FieldValidationError` — field-keyed, no `code`.
A `parseBillingError(response)` returning a discriminated union, plus `Remedy` and `ResourceKey` unions re-exported from the generated enums.

### 3.2 Payment-provider abstraction types (Phase 6)
- `PaymentProvider` view model from `billing_payment_provider_retrieve` (`provider` + populated Stripe credentials).
- `CardCapture` interface (`tokenize(): Promise<{ payment_token: string }>`) with a Stripe implementation; a factory selecting by resolved provider.

### 3.3 Remedy-routing types (Phase 10)
- `RemedyRoute` mapping each `remedy` (`purchase_add_on`, `upgrade_plan`, `add_payment_method`, `resolve_billing`) to a billing destination + optional resource context.

## 4. API Design

No endpoints authored here; this section records the consumed operations (generated `@src/client` operationIds) and the hook that wraps each. All are tenant-scoped and inherit `X-Organization-Id` from [authentication-fetch-interceptors.ts](src/lib/authentication-fetch-interceptors.ts).

### 4.1 Reads
- `billing_subscription_retrieve_subscription_retrieve` → `useSubscription` (Phase 2).
- `billing_plans_list` → `usePlans` (Phase 3).
- `billing_usage_retrieve_usage_retrieve` → `useUsage` (Phase 3).
- `billing_usage_periods_list` / `billing_usage_periods_retrieve` → `useBillingPeriods` (Phase 4).
- `billing_usage_occurrences_list` → `useUsageLedger` (Phase 4, admin-only).
- `billing_profile_retrieve_billing_profile_retrieve` → `useBillingProfile` (Phase 5).
- `billing_payment_provider_retrieve` (+ `_default_retrieve`) → `usePaymentProvider` (Phase 6).

### 4.2 Writes
- `billing_profile_create/update/partial_update` → billing-profile mutations (Phase 5).
- `billing_subscription_change_plan_create` → `useChangePlan` (Phase 7).
- `billing_subscription_cancel_create` → `useCancelSubscription` (Phase 7).
- `billing_add_ons_create` / `billing_add_ons_destroy` → `usePurchaseAddOn` / `useStopAddOn` (Phase 8).
- `billing_subscription_retry_payment_create` → `useRetryPayment` (Phase 9).

Error contract consumed on writes: `402 limit_exceeded` (Phase 10 global handler) and `402 charge_declined` (Phase 9), plus the `400`/`409` coded errors per flow.

## 5. Phased Rollout

Order: foundation parsing → read-only surface (gives value + remedy destinations) → billing profile → shared payment infra → transactional/payment flows → global over-limit handler last (all destinations exist, routing deep-links precisely).

### Phase 1 — Billing error-contract parsing layer

**Goal**: a single tested module that turns any billing error response into a typed, `code`-discriminated value. Ship value: none user-visible on its own — scaffolding every later write phase consumes.

**Feature flag**: none — purely additive new module, no existing code path changes.

Changes:
1. New `@src/lib/billing/billing-errors.ts`: `parseBillingError`, the discriminated union types (see Data Model Changes 3.1), the `Remedy` / `ResourceKey` / coded-error-code unions re-exported from generated enums.
2. Helpers: `isLimitExceeded`, `isChargeDeclined`, `remedyOf`, and a `billingErrorMessage` that returns `detail` for logging only (never used for branching).

Spec use-case: shared scaffolding — no use-case yet (backs the error-handling in every write phase and Phase 10).

Tests:
- **Unit**: `@src/lib/billing/billing-errors.test.ts` — each shape (limit_exceeded rich body, each coded error, field-validation-without-code) parses to the right variant; an unknown `code` falls through to a safe generic variant; a non-billing error is left unrecognized.

**Suggested AI model**: Tier 2 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). Pure TS discrimination against generated types, established repo patterns.

**Reusable skills**: none — not a route/component/hook.

Acceptance: `parseBillingError` returns the correct discriminated variant for every documented billing error body and a safe fallback for unknowns, proven by unit tests; no other code imports it yet.

### Phase 2 — Billing area shell, navigation, subscription read + state banner

**Goal**: a member can open a new top-level **Billing** section, see the current subscription (plan, state, interval, pending change), and the app shows a global grace/restricted banner driven by `billing_state`.

**Feature flag**: none — additive new route group + new nav item; the global banner reads only the new subscription query and renders nothing in `free`/`active`.

Changes:
1. New route group `@src/app/(app)/billing/` with a layout + index (subscription overview). Server-first shell, client island for the subscription view.
2. New `@src/hooks/billing/use-subscription.ts` wrapping `billing_subscription_retrieve_subscription_retrieve`; handles the `404 no subscription` case as an empty state, not an error.
3. New `@src/components/billing/subscription-overview.tsx` — plan name, `billing_state`, interval, `pending_plan_slug`/effective date.
4. New `@src/components/billing/billing-state-banner.tsx` mounted app-wide (in the app layout) — informational in `grace`, prominent in `restricted` with a "settle balance" link (target lands Phase 9; until then links to the billing section).
5. Nav: add a member-visible `billing` item to `MEMBER_NAV_ITEMS` in [app-layout-client.tsx](src/components/navigation/app-layout-client.tsx) and update `buildNavGroups` tests.

Spec use-case: subscription view + billing-state banner (Decisions → Use-cases "any member views current usage" neighbourhood; Acceptance scenario "Restricted — writes blocked, reads open").

Tests:
- **Unit**: `subscription-overview.test.tsx` — renders plan/state/interval; pending change shown when `pending_plan_slug` differs; no-subscription empty state.
- **Integration**: `billing-state-banner.test.tsx` — banner hidden in `free`/`active`, informational in `grace`, prominent in `restricted`; `app-layout-client.test.tsx` — `billing` nav id present for member and admin roles.

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). New route + client island + app-global banner wiring across the layout.

**Reusable skills**: `new-page` (billing route group), `new-hook` (`use-subscription`), `new-composition` (`subscription-overview`, `billing-state-banner`).

Acceptance: navigating to Billing shows the current subscription (or a clean empty state), and a restricted org shows the app-wide restricted banner while all reads remain accessible.

### Phase 3 — Plans catalog + usage meters (read-only)

**Goal**: an admin can browse active plans (filtered to the org currency, monthly/annual toggle, limits + entitlements), and any member can see current usage meters with correct unlimited (∞) rendering.

**Feature flag**: none — additive read-only views under the new billing section.

Changes:
1. New `@src/hooks/billing/use-plans.ts` (`billing_plans_list`, `is_active`/`currency` params) and `@src/hooks/billing/use-usage.ts` (`billing_usage_retrieve_usage_retrieve`).
2. New `@src/components/billing/plans-catalog.tsx` — plan cards with limits/entitlements, currency filter defaulted to the subscription currency, monthly/annual toggle where `annual_price` exists.
3. New `@src/components/billing/usage-meters.tsx` — one meter per resource; `limit_value: null` → "unlimited / ∞" (never a full bar), `0` → "not included", positive → usage/ceiling.
4. New billing sub-routes for `plans` and `usage`.

Spec use-case: "Admin views plans" (read portion) + "Any member views current usage".

Tests:
- **Unit**: `usage-meters.test.tsx` — null → ∞, zero → not-included, positive → ratio; `plans-catalog.test.tsx` — currency filter + annual toggle visibility.
- **Integration**: plans list paginates and filters by currency; usage view readable in `restricted` state.

**Suggested AI model**: Tier 2 for the hooks + meters; Tier 3 for the plans catalog with currency/interval logic. IDs per tier in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml).

**Reusable skills**: `new-hook` (`use-plans`, `use-usage`), `new-composition` (`plans-catalog`, `usage-meters`).

Acceptance: the plans catalog renders active plans for the org currency with a working interval toggle, and usage meters render unlimited resources as ∞ rather than a full bar.

### Phase 4 — Usage ledger & billing history

**Goal**: any member sees the billing-period list; an admin can drill into a period's line-item metered-occurrence ledger to reconcile post-paid charges.

**Feature flag**: none — additive; the admin-only drill-in reuses the existing `RoleGate`.

Changes:
1. New `@src/hooks/billing/use-billing-periods.ts` (`billing_usage_periods_list` / `_retrieve`) and `@src/hooks/billing/use-usage-ledger.ts` (`billing_usage_occurrences_list` with period/allowance/organization/occurrence-start filters + ordering + pagination).
2. New `@src/components/billing/billing-history.tsx` (period list, member-visible) and `@src/components/billing/usage-ledger.tsx` (occurrence table, admin-only via `RoleGate`).
3. Ledger `403`/permission handling: the occurrences endpoint requires billing-owner/admin — gate the UI and handle a defensive 403.

Spec use-case: "Admin reconciles the usage ledger / billing history".

Tests:
- **Unit**: `usage-ledger.test.tsx` — filter + ordering controls; empty period.
- **Integration**: `billing-history.test.tsx` — member sees the period list but not the ledger drill-in; admin sees both; ledger paginates.

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). Filterable/paginated admin-gated table across two hooks.

**Reusable skills**: `new-hook` (`use-billing-periods`, `use-usage-ledger`), `new-composition` (`billing-history`, `usage-ledger`).

Acceptance: an admin can open a billing period and see its metered-occurrence ledger filtered by time range, while a non-admin sees the period list without the ledger.

### Phase 5 — Billing profile create/edit

**Goal**: an admin can create/edit the org billing profile (required contact name+email, document type from the nine-value enum, address); non-admin writes are rejected with a clear admin-only message; reads tolerate legacy document types.

**Feature flag**: none — additive billing-profile screens; the endpoints already enforce admin-only writes server-side.

Changes:
1. New billing-profile hooks in `@src/hooks/billing/`: `use-billing-profile.ts` (retrieve) + create/update/partial_update mutations, org-keyed (one profile per org; a second create surfaces the conflict).
2. New `@src/components/billing/billing-profile-form.tsx` — react-hook-form + zod; required `contact_first_name`/`contact_email`, optional last name/phone/document number/address; `document_type` as a select constrained to `BillingProfileDocumentTypeEnum` on write; read model accepts an out-of-enum legacy value without breaking.
3. Admin-only write affordance via `RoleGate`; defensive `403` handling shows the admin-only message and leaves the form intact. Field-validation `400`s (no `code`) surface per field via the Phase 1 parser.
4. New billing sub-route `profile`.

Spec use-case: "Admin creates the billing profile" + "Non-admin member tries to edit the billing profile".

Tests:
- **Unit**: `billing-profile-form.test.tsx` — required-field validation blocks submit; document-type select offers exactly the nine values; a legacy read value renders.
- **Integration**: create then re-create surfaces conflict; non-admin write path shows the admin-only message and writes nothing; server field-error maps to the right field.

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). Multi-field form with enum/read asymmetry, role gating, and coded + field error handling.

**Reusable skills**: `new-hook` (billing-profile hooks), `new-composition` (`billing-profile-form`).

Acceptance: an admin can create and edit the profile with a valid document type; a document type outside the enum is blocked on write while a legacy value still displays on read; a non-admin write is rejected cleanly.

### Phase 6 — Payment provider abstraction + Stripe card tokenization

**Goal**: a shared, provider-read-at-runtime card-capture capability that tokenizes a card into a `payment_token` via Stripe. Ship value: none user-visible alone — shared infra Phases 7–9 consume.

**Feature flag**: none — additive module + hook; no existing path changes.

Changes:
1. New `@src/hooks/billing/use-payment-provider.ts` wrapping `billing_payment_provider_retrieve` (authenticated) with the `_default_retrieve` fallback for pre-subscription contexts; exposes resolved `provider` + Stripe publishable key.
2. New `@src/lib/billing/card-capture/` — a `CardCapture` interface, a Stripe implementation loading Stripe.js and tokenizing with the runtime publishable key, and a factory selecting by resolved provider (throws a typed "provider unsupported" for anything but Stripe).
3. New `@src/components/billing/card-capture-fields.tsx` — the Stripe card element wrapper used by the write flows.
4. CSP / external-script note: Stripe.js loads from its host. **The app sets no `Content-Security-Policy` today** (no `headers()` in `next.config.ts`, no middleware), so nothing blocks Stripe and this phase needs no CSP change — see Risk & Rollout Notes.

Spec use-case: shared scaffolding — no use-case yet (Payment provider & credentials decision in the spec).

Tests:
- **Unit**: `card-capture` factory returns the Stripe implementation for `stripe` and throws for an unsupported provider; `use-payment-provider` surfaces the publishable key from the resolved provider only.
- **Integration**: `card-capture-fields.test.tsx` with the Stripe SDK mocked — tokenize resolves to a `payment_token`; a tokenization failure surfaces a field-level error.

**Suggested AI model**: Tier 4 for the Stripe.js loader + provider abstraction (novel external-SDK integration, runtime-key handling); Tier 2 for the `use-payment-provider` hook. IDs per tier in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml).

**Review models**: reviewer Tier 4 — this phase introduces an external payment SDK and the runtime-key path that every paid flow depends on; a subtle mistake here (leaking a secret, mis-scoping the key, a tokenization race) is high blast-radius. Fixer left on the project default.

**Reusable skills**: `new-hook` (`use-payment-provider`).

Acceptance: given a Stripe-resolved provider and its runtime publishable key, the card-capture component tokenizes a card into a `payment_token`; an unsupported provider yields a clear, typed "not available" outcome.

### Phase 7 — Plan change & cancel

**Goal**: an admin can upgrade (async, polled), schedule a downgrade (effective at period end), and cancel — with first-time card capture, idempotency, and the coded conflict/`payment_token_required`/`provider_not_configured` cases handled.

**Feature flag**: none — additive actions on the new subscription view.

Changes:
1. New `@src/hooks/billing/use-change-plan.ts` (`billing_subscription_change_plan_create`) and `use-cancel-subscription.ts` (`billing_subscription_cancel_create`); one idempotency key per intent held across retries.
2. New `@src/components/billing/change-plan-dialog.tsx` — target plan + interval; captures a card (Phase 6) only when `payment_token_required` (`400`) says an instrument is needed; on upgrade shows pending + polls `useSubscription` until `plan.slug` flips; on downgrade shows the scheduled effective date.
3. Coded-error handling via the Phase 1 parser: `unconfirmed_plan_change` → "a change is already pending"; `payment_provider_not_configured` → distinct message; `payment_token_required` → prompt for a card.
4. Cancel confirmation surfacing the state transition.

Spec use-case: "Admin views plans and changes plan" (change portion) + "Admin cancels the subscription".

Tests:
- **Unit**: `change-plan-dialog.test.tsx` — upgrade shows pending + polls to effective; downgrade shows scheduled date; each coded error shows its distinct message.
- **Integration**: idempotency key reused across a simulated retry (one logical change); cancel transitions the view.

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). Async polling + conditional card capture + several coded-error branches.

**Reusable skills**: `new-hook` (`use-change-plan`, `use-cancel-subscription`), `new-composition` (`change-plan-dialog`).

Acceptance: an upgrade shows pending and only reflects the new plan after it takes effect; a second concurrent change is refused with the pending-change message; a downgrade shows its scheduled date; cancel transitions the subscription.

### Phase 8 — Capacity add-on purchase & stop

**Goal**: an admin can purchase a capacity add-on (async, polled to active) and stop a recurring one; non-purchasable resources and provider-not-configured are handled.

**Feature flag**: none — additive add-on management on the billing section.

Changes:
1. New `@src/hooks/billing/use-purchase-add-on.ts` (`billing_add_ons_create`) and `use-stop-add-on.ts` (`billing_add_ons_destroy`); idempotency key per intent; card capture when no instrument on file.
2. New `@src/components/billing/add-on-purchase-dialog.tsx` — resource + quantity; on success shows pending-activation and polls until `is_active` flips; `add_on_not_purchasable` (`400`) surfaced on the field; `payment_provider_not_configured` distinct message.
3. Add-on list on the subscription view with a "stop recurring" action (holds capacity until period end).

Spec use-case: "Admin purchases a capacity add-on".

Tests:
- **Unit**: `add-on-purchase-dialog.test.tsx` — pending-activation then active via polling; `add_on_not_purchasable` on the field.
- **Integration**: stop-recurring marks non-renewing; idempotency reused across retry.

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). Mirrors Phase 7's async+capture pattern; some precedent reduces novelty.

**Reusable skills**: `new-hook` (`use-purchase-add-on`, `use-stop-add-on`), `new-composition` (`add-on-purchase-dialog`).

Acceptance: purchasing an add-on shows pending activation and reflects added capacity once active; a non-purchasable resource is rejected on the field; stopping a recurring add-on marks it non-renewing.

### Phase 9 — Grace recovery (retry-payment) & card replacement

**Goal**: an admin of a grace/restricted subscription can replace a dead card and collect the outstanding balance via `retry-payment`, with `charge_declined` handled as "try another card", the 2xx-not-active reality polled, and each non-applicable coded case messaged.

**Feature flag**: none — additive recovery flow reached from the banner/remedy.

Changes:
1. New `@src/hooks/billing/use-retry-payment.ts` (`billing_subscription_retry_payment_create`); one idempotency key held across retries of the same attempt, a **new** key for a genuinely new card.
2. New `@src/components/billing/retry-payment-dialog.tsx` — captures a new card (Phase 6), submits, shows pending and polls `useSubscription` until `active` (never "success" off the 2xx); on `charge_declined` (`402`, distinguished from `limit_exceeded` by `code`) asks for a different card and refetches the subscription rather than asserting nothing was charged.
3. Coded 409 handling: `retry_payment_not_applicable` / `no_outstanding_balance` / `collection_not_supported` each a distinct message; `subscription_not_attached` routes to the first-payment/upgrade flow (Phase 7).
4. Wire the Phase 2 restricted-banner "settle balance" link to this dialog.

Spec use-case: "Admin recovers a subscription in grace with a dead card".

Tests:
- **Unit**: `retry-payment-dialog.test.tsx` — 2xx shows pending (not success) + polls to active; `charge_declined` re-prompts with a new key; each 409 code its own message.
- **Integration**: `subscription_not_attached` routes to first-payment; idempotency reused across a same-attempt retry, new key on a new card.

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). Consumes the Phase 6/7 patterns; the delicate part is idempotency-key lifecycle.

**Review models**: reviewer Tier 4 — the idempotency-key lifecycle here is the one place a bug **double-charges a real user**; the independent review runs on the most capable model. Fixer left on the project default.

**Reusable skills**: `new-hook` (`use-retry-payment`), `new-composition` (`retry-payment-dialog`).

Acceptance: submitting a new card in grace shows pending and only reports active after the subscription flips; a declined card re-prompts with a fresh idempotency key; each non-applicable case shows its distinct message and `subscription_not_attached` routes to first payment.

### Phase 10 — Global over-limit handler + remedy routing

**Goal**: every user-reachable guarded write that returns `limit_exceeded` restores the pre-submit UI, shows a message, and routes to the matching remedy destination (all of which now exist).

**Feature flag**: none — see Guiding Decisions. The handler branches only on `limit_exceeded` (inert in production today) and passes every other error through unchanged; a pass-through test asserts existing mutations are unaffected.

Changes:
1. Add a global `MutationCache.onError` to the shared QueryClient in [query-client-provider.tsx](src/components/query-client-provider.tsx) that runs `parseBillingError` (Phase 1) and, on `limit_exceeded`, dispatches remedy routing; non-billing errors are untouched (existing per-hook handling still runs).
2. New `@src/components/billing/remedy-router.tsx` (+ a small context/controller): `purchase_add_on` → add-on dialog (Phase 8) pre-filled with `resource`; `upgrade_plan` → plans/change-plan (Phase 3/7); `add_payment_method` → card capture/retry (Phase 6/9); `resolve_billing` → retry-payment (Phase 9). Unknown remedy → generic "manage billing" fallback.
3. Confirm the user-reachable guarded creation flows surface the rollback cleanly (server already rolled back; ensure optimistic UI, if any, is reverted): invitations, member reactivate, resource/bundle calendars, calendar groups, availability windows, webhook configs, system users, event/booking creation. (Enumerated in the spec's guarded-operations list.)

Spec use-case: "Member hits a capacity ceiling while creating a resource".

Tests:
- **Unit**: `remedy-router.test.tsx` — each of the four remedies routes to the right destination with resource context; unknown remedy → fallback.
- **Integration**: a simulated `limit_exceeded` on a representative guarded mutation (e.g. create invitation) restores UI and routes by remedy; a **pass-through** test asserts a non-billing mutation error is handled exactly as before (no regression).

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). Touches the shared QueryClient and coordinates routing across all billing destinations.

**Review models**: reviewer Tier 4 — this is the only change that touches the shared mutation path used by every existing write; the independent review verifies non-billing errors are provably untouched. Fixer left on the project default.

**Reusable skills**: `new-composition` (`remedy-router`).

Acceptance: a guarded write returning `limit_exceeded` restores the pre-submit UI and routes to the correct remedy for all four remedies, while a non-billing mutation error behaves identically to before (proven by a pass-through test).

## 6. Risk & Rollout Notes

- **No feature flag / no kill switch.** The only existing-flow change is Phase 10's global `MutationCache.onError`, which acts only on `limit_exceeded` (impossible in production today) and passes all other errors through. Mitigation: the pass-through regression test in Phase 10; the change is a small, revertible diff on one provider file. Rollback = revert the Phase 10 PR.
- **Stripe.js external script + CSP.** Phase 6 loads Stripe.js from Stripe's host, and card fields render in Stripe-hosted iframes. CSP is enforced by the browser against the policy delivered with **this app's** HTML documents, not the API's — this app serves the pages that run Stripe.js. **This app sets no CSP today** (confirmed: no `headers()` in `next.config.ts`, no `middleware.ts`, no CSP anywhere in the repo), so the browser applies no script-source restriction and Stripe loads as-is — **Phase 6 has nothing to unblock and is not gated on any CSP work.** The publishable key is browser-safe (never a secret) and comes from `GET /billing/payment-provider/` at runtime; no env var is added. Adding a hardened CSP is a separate, optional task that protects the *entire* app (not just billing) and should not ride billing's rollout; if pursued, it must allow `script-src https://js.stripe.com`, `frame-src https://js.stripe.com https://hooks.stripe.com`, and `connect-src https://api.stripe.com`.
- **Double-charge via idempotency.** Phases 7–9 must generate one idempotency key per intent and hold it across automatic retries, minting a new key only for a genuinely new attempt. Covered by tests; Phase 9 review runs on Tier 4.
- **Async confirmation may lag/hang.** Upgrades, add-ons, and retry-payment poll until state changes; bound the polling with a "still processing — check back" terminal state so the UI never spins forever.
- **Inert in production.** All over-limit and restricted-state handling is unverifiable against real production behavior (every org is unlimited); it is verified against simulated contracts in tests. The future plan rollout is the first real exercise — no client change should be needed then.
- **Provider assumption.** Only Stripe is built; the provider is read at runtime. If an org is unexpectedly routed to MercadoPago, its capture/collection flows surface a clear "not available" message rather than breaking.
- **No migrations, no backfill, no locks** — frontend-only.

## 7. Open Questions

1. **Polling cadence / timeout and ledger page sizes.** Not fixed by the backend. Recommended default: bounded polling (a few attempts with backoff) ending in a "still processing — check back" state; newest-first ledger pages of a sensible size. Owner: implementing team + design, during Phases 7–9 / Phase 4.
2. **CSP hardening (optional, not a blocker).** The app ships **no CSP today**, so Phase 6 is unblocked — Stripe loads without any policy change. The open question is only whether to *introduce* a CSP as a hardening measure. Recommended default: treat it as a separate task decoupled from billing (it governs the whole app), and if pursued, include the Stripe `script-src`/`frame-src`/`connect-src` allowances above. Owner: whoever owns the app's security headers.
3. **MercadoPago trigger.** Out of scope here; build its path only once an account exists and an org is routed to it. Owner: billing backend owner + product. The runtime provider read means no change is needed until then.

## 8. Touch List

**Phase 1 — error parsing**
- Create: `@src/lib/billing/billing-errors.ts`, `@src/lib/billing/billing-errors.test.ts`

**Phase 2 — shell + subscription + banner**
- Create: `@src/app/(app)/billing/layout.tsx`, `@src/app/(app)/billing/page.tsx`, `@src/hooks/billing/use-subscription.ts`, `@src/components/billing/subscription-overview.tsx`, `@src/components/billing/billing-state-banner.tsx` (+ tests)
- Edit: [app-layout-client.tsx](src/components/navigation/app-layout-client.tsx) (add `billing` nav item; mount banner), [app-layout-client.test.tsx](src/components/navigation/app-layout-client.test.tsx)

**Phase 3 — plans + usage**
- Create: `@src/hooks/billing/use-plans.ts`, `@src/hooks/billing/use-usage.ts`, `@src/components/billing/plans-catalog.tsx`, `@src/components/billing/usage-meters.tsx`, `@src/app/(app)/billing/plans/page.tsx`, `@src/app/(app)/billing/usage/page.tsx` (+ tests)

**Phase 4 — ledger**
- Create: `@src/hooks/billing/use-billing-periods.ts`, `@src/hooks/billing/use-usage-ledger.ts`, `@src/components/billing/billing-history.tsx`, `@src/components/billing/usage-ledger.tsx`, `@src/app/(app)/billing/history/page.tsx` (+ tests)

**Phase 5 — profile**
- Create: `@src/hooks/billing/use-billing-profile.ts` (+ mutations), `@src/components/billing/billing-profile-form.tsx`, `@src/app/(app)/billing/profile/page.tsx` (+ tests)

**Phase 6 — payment provider + Stripe**
- Create: `@src/hooks/billing/use-payment-provider.ts`, `@src/lib/billing/card-capture/` (interface, stripe impl, factory), `@src/components/billing/card-capture-fields.tsx` (+ tests)
- No CSP change required (app ships no CSP today); any CSP hardening is a separate optional task — see Risk & Rollout Notes

**Phase 7 — plan change & cancel**
- Create: `@src/hooks/billing/use-change-plan.ts`, `@src/hooks/billing/use-cancel-subscription.ts`, `@src/components/billing/change-plan-dialog.tsx` (+ tests)
- Edit: `@src/components/billing/subscription-overview.tsx` (change/cancel affordances)

**Phase 8 — add-ons**
- Create: `@src/hooks/billing/use-purchase-add-on.ts`, `@src/hooks/billing/use-stop-add-on.ts`, `@src/components/billing/add-on-purchase-dialog.tsx` (+ tests)
- Edit: `@src/components/billing/subscription-overview.tsx` (add-on list + stop action)

**Phase 9 — retry-payment**
- Create: `@src/hooks/billing/use-retry-payment.ts`, `@src/components/billing/retry-payment-dialog.tsx` (+ tests)
- Edit: `@src/components/billing/billing-state-banner.tsx` (wire "settle balance" to the dialog)

**Phase 10 — global over-limit handler + remedy routing**
- Create: `@src/components/billing/remedy-router.tsx` (+ context/controller, tests)
- Edit: [query-client-provider.tsx](src/components/query-client-provider.tsx) (global `MutationCache.onError`)
