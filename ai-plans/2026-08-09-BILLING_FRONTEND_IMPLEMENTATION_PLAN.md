# Billing Frontend — Implementation Plan

The web app has **no billing UI at all** today. The API, meanwhile, now exposes a
complete billing surface: a plan catalog, subscription management, add-on purchase,
an enriched current-usage summary, durable closed-period statements, and a line-item
occurrence ledger. This plan builds the frontend that consumes all of it — from a
free organization self-serve upgrading, through buying capacity, to auditing exactly
what it was charged for.

There is no sibling `..._SPEC.md` in this repo. This is a **presentation/consumption**
feature grounded directly in the API's own two specs, which were settled by
interrogation before this frontend work:

- Requirements source: [`vinta-schedule-api/ai-plans/2026-07-18-BILLING_PLANS_AND_LIMITS_SPEC.md`](../../vinta-schedule-api/ai-plans/2026-07-18-BILLING_PLANS_AND_LIMITS_SPEC.md) — the commercial layer, its lifecycle states, and its eight use-cases.
- Requirements source: [`vinta-schedule-api/ai-plans/2026-08-08-BILLING_USAGE_SUMMARY_AND_LEDGER_IMPLEMENTATION_PLAN.md`](../../vinta-schedule-api/ai-plans/2026-08-08-BILLING_USAGE_SUMMARY_AND_LEDGER_IMPLEMENTATION_PLAN.md) — the reporting half (enriched usage, statements, ledger).

Every use-case reference below (`Use-case 1` … `Use-case 8`) points at the **Decisions → Use-cases** section of the Billing Plans & Limits spec.

## 1. Goals

1. **A free organization can self-serve upgrade, end to end, in the browser.** An admin picks a paid plan, provides a payment instrument, and — once the provider confirms — sees its limits lift, with no support or engineering intervention. Mirrors the API spec's objective 2.
2. **An organization can see exactly where it stands and what it will be charged.** A current-usage dashboard (per-resource usage against effective limits, plan/add-on split, reseller attribution, accrued overage), a history of closed-period statements, and a line-item ledger tying every unit of post-paid money to a specific occurrence.
3. **An organization can buy more capacity and manage its commercial relationship.** Purchase pre-paid add-ons, cancel recurring add-ons, change or cancel the plan, and maintain the billing profile (tax/payer identity) — each gated to the right role.
4. **Being blocked is never the first signal that a limit exists.** The existing over-limit rejection (calendar groups) gains a real destination: a deep-link into the billing surface that shows the hit limit and the upgrade/purchase path. Mirrors Use-case 8.

**Non-goals:**

- **Authoring any API endpoint, model, or migration.** This repo consumes the existing REST surface only. No backend change is in scope; the one backend dependency is that `schema.yml` is re-synced from the API repo (Phase 0).
- **A new payment provider, or changing how tokens are minted.** The frontend tokenizes card data with whichever provider the API resolves (Stripe or MercadoPago) and hands the resulting `payment_token` to the existing endpoints. It does not add a provider, alter the charge path, or handle webhooks (those are server-side).
- **Rendering invoices, receipts, or tax documents.** The API explicitly does not produce fiscal documents (Billing Plans & Limits spec, **Negative scope**); neither does this UI. Statements are usage statements, not invoices.
- **Dunning / grace-period orchestration UI beyond surfacing state.** The UI _shows_ `billing_state` (GRACE / RESTRICTED) and the grace deadline, and links to "resolve payment", but the retry ladder, escalating notifications, and restricted-state enforcement are all server-side. No dunning management screen.
- **CSV / Excel export of the ledger.** The API deferred this (its own Non-goals); the paginated JSON ledger is the audit surface here too.
- **Trend charts, projections, forecasts.** The dashboard reports current usage and overage _accrued to date_ — it does not project an end-of-cycle total, matching the API's `estimated_overage_total` semantics.
- **Marketing pricing page changes.** [`src/app/(marketing)/pricing/page.tsx`](<src/app/(marketing)/pricing/page.tsx>) currently tells a "free / self-hosted" story. Reconciling that public narrative with paid plans is a product decision, tracked in **Open Questions**, not built here.
- **A native mobile surface.** Web SPA only.

## 2. Guiding Decisions

| Decision                                                                           | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scope = full billing frontend**                                                  | The requester chose the full surface (not usage-reporting-only) in Step 0. Every API billing capability gets a frontend, sequenced so the slowest-to-get-right dependency (provider tokenization) lands first and the read-only surfaces can ship independently of the write flows.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Grounded in the API specs, no separate frontend SPEC**                           | Chosen in Step 0. This is a consumption feature — a second spec would restate the API's decisions. The two API specs are cited inline as the requirements source; where the frontend makes a _UI_ decision the specs don't cover, it appears in this table or in **Open Questions**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Bundling granularity**                                                           | Chosen in Step 0. Closely-related use-cases share a phase where it cuts churn (plan catalog + upgrade + cancel in one; statement list + detail in one; add-on purchase + recurring-cancel in one). Each phase still stays MR-sized (≤1500 LoC), single-concern, and independently mergeable/reversible.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **No feature flag — purely additive new surface**                                  | The frontend has **no feature-flag framework** (confirmed by search; the API repo made the same call). Every phase here is a brand-new route/hook/component that no existing code reads. The single existing-surface touch (Phase 9: sidebar entry + over-limit alert deep-link) is guarded by ordinary conditional rendering — the entry points render only once the billing data layer resolves — not by a flag. If the billing routes are merged but unlinked, nothing else changes.                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Provider tokenization is a reusable primitive, built first**                     | `change-plan` and `add-ons` both need a `payment_token`, minted client-side by the provider's own JS SDK (Stripe.js `publishable_key` / MercadoPago.js `public_key`) from `GET /billing/payment-provider/`. This is the only genuinely novel piece (no precedent in the repo, two providers, external scripts). It is Phase 1 — before any flow that consumes it — because it is the slowest dependency to get right, and it carries a reviewer step-up.                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Payment success is asynchronous; the UI polls, it does not assume**              | Capacity/plan grant happens on a **provider webhook**, not on the initiate request (see [`payments/views.py`](../../vinta-schedule-api/payments/views.py) `_apply_*_side_effects`). `POST /billing/add-ons/` returns `201` before the charge confirms; `change-plan` returns with a `pending_*` subscription. Every purchase flow therefore ends in a **pending-confirmation** state that re-reads the subscription/add-on **every ~3s for up to ~60s**, then falls back to a calm "we're still confirming your payment" state with a manual refresh — never an indefinite spinner, never "done" off the initiate response alone. This polling primitive (with the 3s/60s bound tunable in one place) ships alongside tokenization in Phase 1.                                                                                                                                                    |
| **Billing interval: offer both, default monthly**                                  | The catalog carries `monthly_price` **and** `annual_price` and the API accepts a `billing_interval`, so the plan picker exposes a monthly/annual toggle defaulting to monthly. Hiding annual would be a picker-only limitation of a contract that already supports it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **GRACE / RESTRICTED recovery is a dedicated flow, not a change-plan detour**      | A failed-payment organization gets a purpose-built "update payment method / retry charge" surface (Phase 5), reached from the billing-state banner — not a reuse of the upgrade dialog. Recovering from dunning is a distinct intent from choosing a new plan (the org keeps its current plan; it is re-attaching an instrument and retrying), and conflating the two would bury the recovery path inside a plan picker. It reuses Phase 1's tokenization + confirmation primitives.                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Idempotency keys are generated per purchase attempt, client-side**               | `change-plan` and `add-ons` both require an `idempotency_key`. A stable key is generated once per user-initiated attempt (via `crypto.randomUUID()`) and **reused across retries of that same attempt**, so a network retry or double-click cannot double-charge — matching the API's idempotency contract (Billing Plans & Limits spec, **Idempotency**). A fresh key is minted only when the user starts a genuinely new attempt.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Role gating: admin client-side, API `403` as the real gate**                     | Reads of usage + statements are open to any authenticated member (`IsAuthenticated`). The occurrence ledger and every write (change-plan, cancel, add-on purchase/cancel, billing-profile writes) require billing-owner-or-admin / org-admin server-side. The UI hides those affordances from members who lack the **admin** role, using the existing membership-role signal ([`use-my-organizations.ts`](src/hooks/organizations/use-my-organizations.ts) / [`use-update-member-role.ts`](src/hooks/team/use-update-member-role.ts)). It deliberately does **not** try to detect the billing-owner designation client-side (its frontend representation is unconfirmed): a billing-owner-who-isn't-admin is served by the API, and the server's `403` is the real gate — it drives a friendly "you don't have billing access" state, so a wrong or missing client signal always degrades safely. |
| **Reseller attribution is shown, not scoped**                                      | The enriched usage response carries `by_organization` across the pooled subtree; the dashboard renders that breakdown so a reseller root sees which child consumed capacity. It does **not** add a "scope down to one child" control — the API deliberately does not support that in v1 (its Open Questions).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **`total: null` on a statement means "not recorded", never 0**                     | The period-statement detail carries nullable per-resource `total` where `null` means the metric was never captured for that period (forward-only history). The UI renders `null` as an explicit "not recorded" affordance, never as `0`, exactly as the API's field description demands.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Money and dates are formatted at the edge, from API-provided currency/timezone** | Amounts are `DecimalField` strings (e.g. `"12.5000"`) with a `currency` from the plan snapshot; the UI formats with `Intl.NumberFormat` using that currency, never a hard-coded `$`. Period bounds are ISO datetimes formatted in the viewer's locale. No client-side money arithmetic beyond display.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Design-system-first, per DESIGN.md**                                             | Every surface is built from `vinta-schedule-design-system` layout primitives + shadcn/ui atoms and design tokens (oklch CSS vars) — no raw divs/hex. Usage bars, state banners, and the plan picker are compositions under `src/components/billing/`, each with a colocated story and test.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## 3. Data Model Changes

This is a frontend; it adds **no persistence and no API endpoints**. "Data model" here means the generated-client types it binds to and the hook-layer types it derives.

### 3.1 Regenerated API client (Phase 0, prerequisite for everything)

`src/client/` is generated by `@hey-api/openapi-ts` from `schema.yml` and is **never hand-edited** (AGENTS.md hard rule). The checked-in client is **stale**: it has the _old_ `/billing/usage/` shape (`UsageResponse = { billing_state, limits: EffectiveLimitUsage[] }`) and lacks the enriched fields, `billing/usage/periods/`, and `billing/usage/occurrences/` entirely.

Phase 0 re-syncs `schema.yml` from the API repo and runs `pnpm run openapi-ts`, after which `src/client/types.gen.ts` and `src/client/@tanstack/react-query.gen.ts` gain (names per the API's operation ids / serializers):

- Enriched `UsageResponse`: `billing_state`, `billing_root_organization_id`, `plan` (nullable snapshot), `billing_period` (nullable bounds), `estimated_overage_total`, and per-limit `included_in_plan` / `add_on_quantity` / `by_organization`.
- `BillingPeriodSummary` (list) + `BillingPeriodSummaryDetail` (with `resources[]`), and the `billing/usage/periods/` list + retrieve operations.
- `MeteredOccurrence` ledger row (`organization`, nullable `event` with `calendar` + `owners`, `occurrence_start`, `billing_period_start`, `is_within_allowance`, `unit_price`) and the `billing/usage/occurrences/` list operation.
- Already present today and reused as-is: `BillingPlan`, `Subscription`, `SubscriptionAddOn`, `BillingProfile`, `PaymentProvider` (discriminated Stripe/MercadoPago public credentials), and the subscription/add-on/plan/billing-profile operations.

### 3.2 New hook domain `src/hooks/billing/`

One hook per generated operation, following the repo's canonical wrapper pattern (import types from `@/client`, option/mutation factories from `@/client/@tanstack/react-query.gen`, return both an ergonomic async fn and the raw query/mutation, invalidate by query-key predicate on write). Read hooks land in Phase 0; write hooks land with their consuming flow.

- Reads (Phase 0): `useBillingUsage`, `useBillingPlans`, `useSubscription`, `usePaymentProvider`, `useBillingProfile`, `useBillingPeriods`, `useBillingPeriod(id)`, `useOccurrenceLedger(filters)`.
- Writes (with their flows): `useChangePlan`, `useCancelSubscription` (Phase 3); `usePurchaseAddOn`, `useCancelAddOn` (Phase 4); `useCreateBillingProfile` / `useUpdateBillingProfile` (Phase 6). Phase 5 (resolve-payment) reuses `useChangePlan`.

### 3.3 Type plumbing (frontend-owned, not generated)

- `src/lib/billing/payment-token.ts` — the provider-agnostic `PaymentToken` type + the `PaymentInstrumentResult` union returned by the tokenization primitive (Phase 1).
- `src/lib/billing/idempotency.ts` — a tiny helper minting/holding a per-attempt idempotency key.
- `src/lib/billing/format.ts` — currency + period formatting helpers (money from `Decimal` string + `currency`, ISO datetime → locale).
- Extend [`src/lib/utils/api-errors.ts`](src/lib/utils/api-errors.ts): a `readBillingConflict()` for the `409` bodies the write endpoints return (unconfirmed plan change in flight; provider not configured), reusing the existing `OverLimitError` parsing for `402`.

## 4. API Design — consumed contracts (no endpoint authored here)

The frontend authors no API. This section fixes the **contract it binds to**, so each phase can be written without re-reading the backend. Method / path / shape / notable errors:

### 4.1 Reads (any authenticated member unless noted)

- `GET /billing/plans/` → `BillingPlan[]` (paginated): `slug`, `name`, `monthly_price`, `annual_price`, `currency`, `grace_period_days`, `limits[]`, `entitlements[]`, `is_default_for_new_organizations`.
- `GET /billing/usage/` → enriched `UsageResponse` (see Data Model Changes → 3.1). `403` when no active organization; a subscription-less org returns `billing_state: "free"`, null plan/period, unlimited rows, `estimated_overage_total: "0.0000"`.
- `GET /billing/subscription/` → `Subscription`: `plan`, `billing_state`, `billing_interval`, `payment_provider`, `current_period_start/end`, `grace_period_ends_at`, `pending_plan_slug` / `pending_billing_interval` / `pending_plan_effective_at`, `add_ons[]`. `404` when the org has no subscription.
- `GET /billing/payment-provider/` → `PaymentProvider`: provider slug + browser-safe creds (`{ publishable_key }` for Stripe or `{ public_key }` for MercadoPago). `403` no org; `409` provider unconfigured in this deployment.
- `GET /billing-profile/` → `BillingProfile`. `GET /billing/usage/periods/` + `/{id}/` → statements (`{id}/` adds `resources[]` with nullable `total`); a pk outside the pool is `404`, an org with no closed periods is an empty `200` list.
- `GET /billing/usage/occurrences/` → **billing-owner/admin only** (`403` otherwise); paginated (`max_limit=1000`), filters `billing_period_start` (defaults to current period), `is_within_allowance`, `organization` (must be inside caller's pool — outside is a validation error), `occurrence_start_after/before`; ordering `-occurrence_start`. `event` may be `null` (deleted event); `event.title` is the series-root title.

### 4.2 Writes (billing-owner/admin or org-admin; throttled `billing-write`)

- `POST /billing/subscription/change-plan/` — body `{ plan_slug, billing_interval, idempotency_key, payment_token? }`. `payment_token` required only the first time the billing root attaches an instrument (else `400 PaymentTokenRequiredError`). `409` when another change awaits confirmation, or the provider is unconfigured. Returns the updated `Subscription` (with `pending_*` set until the webhook confirms).
- `POST /billing/subscription/cancel/` — no body; plan runs to period end, then falls back to free.
- `POST /billing/add-ons/` — body `{ resource_key, quantity, is_recurring, idempotency_key, payment_token? }`. `201` with the `SubscriptionAddOn` **before** the charge confirms; capacity lifts on the provider webhook. `409` provider unconfigured.
- `DELETE /billing/add-ons/{id}/` — stops a recurring add-on renewing at period end.
- `POST|PUT|PATCH /billing-profile/` — create/update tax + payer identity; **org-admin** gated; `409` on create when one already exists.

## 5. Phased Rollout

Ten phases. Foundation first, then the slowest dependency (provider tokenization), then read surfaces and write flows that can each merge and ship independently. No feature flag (see **Guiding Decisions**), so there is no flag-removal phase.

---

### Phase 0 — Resync schema, regenerate client, scaffold billing reads

**Goal**: the generated client carries the full billing contract and the read hooks + route group skeleton exist. Ship value: none on its own — this is the data layer every later phase binds to, split out so the (large, mechanical) codegen diff is reviewed apart from feature logic.

**Feature flag**: none — regenerated codegen + brand-new hooks/route group no existing code reads. See **Guiding Decisions**.

Changes:

1. Re-sync `schema.yml` from the API repo (the billing usage/periods/occurrences endpoints must be present) and run `pnpm run openapi-ts`. Commit the regenerated `src/client/` (never hand-edited). Do **not** `git add -A` (AGENTS.md — secrets + codegen churn); stage `schema.yml` + `src/client/` explicitly.
2. `src/hooks/billing/` — the read hooks in Data Model Changes → 3.2, each colocated with a `*.test.ts` asserting query key + option wiring against the generated factory.
3. `src/app/(app)/billing/` — a route-group skeleton: a server-component `layout.tsx` (billing shell) and a placeholder `page.tsx` rendering nothing user-facing yet (real content in Phase 2). No sidebar entry yet (Phase 9).
4. `src/lib/billing/format.ts` + `src/lib/billing/idempotency.ts` + `readBillingConflict()` added to [`src/lib/utils/api-errors.ts`](src/lib/utils/api-errors.ts), all unit-tested.

Spec use-case: shared scaffolding — no use-case yet.

Tests:

- **Unit**: `src/hooks/billing/*.test.ts` — each read hook spreads the correct generated `*Options({...})` and exposes the expected return shape.
- **Unit**: `src/lib/billing/format.test.ts` — money formats from `Decimal` string + currency (no hard-coded symbol); `total: null` formats as "not recorded", not `0`. `idempotency.test.ts` — a key is stable within an attempt, fresh across attempts.
- **Integration**: `src/app/(app)/billing/page.test.tsx` — the skeleton route renders under the app shell without a billing entitlement and throws nothing.

**Suggested AI model**: Tier 1 for the codegen regen (mechanical, exact-precedent), stepping to Tier 2 for the eight read hooks + format/idempotency helpers. IDs per tier in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml).

**Reusable skills**: `new-hook` (each billing read hook); `new-page` (the `(app)/billing/` route-group skeleton).

Acceptance: `pnpm run typecheck && pnpm run lint && pnpm run test` are green; the generated client exposes the usage/periods/occurrences operations and enriched `UsageResponse`; `src/hooks/billing/` read hooks compile against them; `/billing` renders an empty shell reachable only by direct URL.

~350 LoC.

---

### Phase 1 — Payment flow primitives: provider tokenization + confirmation polling

**Goal**: a reusable, provider-agnostic way to (a) collect a payment instrument and mint a `payment_token`, and (b) wait for a provider-confirmed outcome after a purchase. Ship value: none consumer-facing on its own — but every purchase flow (Phases 3, 4) depends on both, and this is the slowest, riskiest piece to get right (external SDKs, two providers, async confirmation), so it lands before its consumers.

**Feature flag**: none — new module nothing existing reads.

Changes:

1. `src/components/billing/payment-instrument-field.tsx` — reads the resolved provider from `usePaymentProvider`, lazy-loads that provider's JS SDK (Stripe.js via `publishable_key`, MercadoPago.js via `public_key`), mounts its secure card element, and exposes an imperative `tokenize()` returning `PaymentInstrumentResult` (`{ token }` or a typed error). The two providers sit behind one component contract so the flows never branch on provider. External SDK `<script>` URLs are config (see `add-env-var` note below), never bundled.
2. `src/hooks/billing/use-await-payment-confirmation.ts` — given a subscription or add-on, re-reads it **every ~3s for up to ~60s** until the webhook-driven state resolves (`pending_*` clears / add-on `is_active` flips), then yields a "still processing" result. The interval + ceiling are module constants tunable in one place. Encapsulates the async-confirmation decision so no flow re-implements polling.
3. `src/lib/billing/payment-token.ts` — the `PaymentToken` / `PaymentInstrumentResult` types (Data Model Changes → 3.3).
4. Colocated stories for the card field in both provider modes (mocked SDKs).

Spec use-case: shared scaffolding for Use-case 3 (buy pre-paid resource) and Use-case 1→Active upgrade (Use-case 1 / objective 2) — no standalone use-case.

Tests:

- **Unit**: `payment-instrument-field.test.tsx` — with a Stripe provider it loads Stripe and `tokenize()` returns the SDK's token; with MercadoPago it loads that SDK; a `409`/unconfigured provider renders a "payments unavailable" state and never mounts a card field.
- **Unit**: `use-await-payment-confirmation.test.ts` — resolves when the polled state flips; returns "still processing" on timeout; stops polling on unmount (no leaked interval).

**Suggested AI model**: Tier 4 — no repo precedent, two external SDKs, secure-element mounting, and an async-confirmation contract every money flow depends on. IDs per tier in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml).

**Review models**: reviewer Tier 4 — this primitive is on the money path and mishandling tokenization or the confirmation race (declaring success before the webhook lands) mis-grants capacity or double-charges. The independent review runs on the most capable model. Fixer left on the project default.

**Reusable skills**: `new-component` (the card field composition); `new-hook` (the confirmation-polling hook); `add-env-var` (the provider SDK script URLs / any non-secret config the loader needs).

Acceptance: `PaymentInstrumentField` mounts the correct provider SDK from `GET /billing/payment-provider/` and returns a `payment_token`; `useAwaitPaymentConfirmation` resolves on a state flip and degrades to "still processing" on timeout without leaking timers; neither is wired into a user flow yet.

~450 LoC.

---

### Phase 2 — Billing overview & current-usage dashboard

**Goal**: an organization opens `/billing` and sees the plan it is on, the cycle it is in, its `billing_state`, per-resource usage against effective limits (with the plan-vs-add-on split), who in its org tree consumed capacity, and the overage accrued so far. Read-only; the primary "where do I stand" surface.

**Feature flag**: none — reads a brand-new route via the Phase 0 hooks.

Changes:

1. `src/app/(app)/billing/page.tsx` — server-first billing overview composing the feature components below from `useBillingUsage` + `useSubscription`.
2. `src/components/billing/` — `billing-state-banner.tsx` (Active/Free/Grace/Restricted, with the grace deadline + a "resolve payment" link when GRACE/RESTRICTED), `plan-summary-card.tsx` (plan snapshot + billing period bounds), `resource-usage-list.tsx` + `resource-usage-row.tsx` (usage bar per resource: `current_usage` vs `limit_value`, `included_in_plan` vs `add_on_quantity`, `overage_unit_price`; unlimited when `limit_value` null), `overage-estimate.tsx` (`estimated_overage_total`, labeled accrued-to-date not projected), and `usage-by-organization.tsx` (the reseller attribution breakdown, rendered only when the pool has >1 org).
3. Empty/degraded states: subscription-less org → "free plan, unlimited" rendering from the API's fail-open response; no active org → the app's standard 403 surface.

Spec use-case: Use-case 8 (Organization inspects its usage) — the current-cycle read, extended with period, cost, and attribution.

Tests:

- **Unit**: colocated `*.test.tsx` + `*.stories.tsx` for each component — usage row renders the plan/add-on split and the unlimited case; the by-organization breakdown hides for a single-org pool; the state banner shows the grace deadline only in GRACE/RESTRICTED.
- **Integration**: `src/app/(app)/billing/page.test.tsx` — a pooled reseller fixture attributes usage to the right children; a free/subscription-less fixture renders unlimited rows and `0.0000` overage without error.

**Suggested AI model**: Tier 3 — an App Router route with server data-loading plus client islands and several cross-field compositions. IDs per tier in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml).

**Reusable skills**: `new-page` (the overview route); `new-composition` (the billing feature components under `src/components/billing/`); `add-storybook-story` (each visual component).

Acceptance: `/billing` renders plan snapshot, period bounds, `billing_state`, per-resource usage with the plan/add-on split, reseller attribution when pooled, and an accrued `estimated_overage_total` — every number sourced from `GET /billing/usage/`, with the free/unlimited path rendering cleanly.

~500 LoC.

---

### Phase 3 — Plan management: catalog, upgrade/downgrade, cancel

**Goal**: an admin browses paid plans, upgrades (providing a payment instrument the first time), downgrades, or cancels — and the UI reflects the pending-then-confirmed lifecycle. Delivers the API spec's objective 2 (self-serve upgrade) in the browser. Bundled: catalog + change-plan + cancel share the subscription and the plan catalog.

**Feature flag**: none — new routes/actions; the write endpoints already exist server-side.

Changes:

1. `src/app/(app)/billing/plans/page.tsx` — the plan picker from `useBillingPlans`, highlighting the current plan, with a **monthly/annual toggle defaulting to monthly** that drives the `billing_interval` sent to `change-plan` and switches each card between `monthly_price` and `annual_price`.
2. `src/components/billing/change-plan-dialog.tsx` — confirms the target plan + interval; when the billing root has no instrument yet, embeds `PaymentInstrumentField` (Phase 1) to mint the `payment_token`; submits via `useChangePlan` with a per-attempt `idempotency_key`; on success enters `useAwaitPaymentConfirmation` and shows a pending state until the subscription's `pending_*` clears. Handles `400 PaymentTokenRequiredError`, `402` over-limit (downgrade below usage), and `409` (change already in flight / provider unconfigured) via `readBillingConflict`.
3. `src/components/billing/cancel-subscription-dialog.tsx` — `useCancelSubscription`; explains the plan runs to period end then falls back to free.
4. `src/hooks/billing/use-change-plan.ts` + `use-cancel-subscription.ts` — mutations invalidating the subscription + usage query keys on success.
5. Role gating: the upgrade/cancel affordances render only for billing-owner/admin; the server `403` is the backstop.

Spec use-case: Use-case 1 (land on free) → Active via upgrade, and the Active→Cancelled→Free transition (**State transitions and edge cases**).

Tests:

- **Unit**: `change-plan-dialog.test.tsx` — first-time upgrade requires the card field and sends the token; a returning upgrade omits it; `409` renders "a change is already processing"; the same `idempotency_key` is reused across a retried submit.
- **Unit**: `cancel-subscription-dialog.test.tsx` — confirms and calls the mutation; explains period-end fallback.
- **Integration**: `plans/page.test.tsx` — the current plan is marked; a member without the role sees no upgrade button.

**Suggested AI model**: Tier 3 — mutation flows with a payment island, async confirmation, and cross-query cache invalidation. IDs per tier in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml).

**Review models**: reviewer Tier 3 — this is the money path (a charge), and the idempotency-key reuse + pending-confirmation handling are where a subtle bug double-charges or falsely reports success. Fixer left on the project default.

**Reusable skills**: `new-page` (plans route); `new-composition` (the dialogs); `new-hook` (the two mutations).

Acceptance: an admin can upgrade a free org (providing a card the first time), see a pending state until confirmation, and land on the new plan; downgrade and cancel work; a retried submit never mints a second idempotency key; `409`/`402`/`400` each render a specific message.

~550 LoC.

---

### Phase 4 — Add-on purchase & recurring-add-on cancellation

**Goal**: an admin buys additional capacity for a pre-paid resource (recurring add-on or one-time pack) and can stop a recurring add-on from renewing. Bundled: purchase + recurring-cancel act on the same add-on collection.

**Feature flag**: none — new actions over existing endpoints.

Changes:

1. `src/components/billing/purchase-add-on-dialog.tsx` — pick resource + quantity + recurring/one-time; embeds `PaymentInstrumentField` when needed; submits via `usePurchaseAddOn` with a per-attempt `idempotency_key`; on `201` enters `useAwaitPaymentConfirmation` until the add-on's `is_active` flips (capacity granted on webhook), showing pending meanwhile. Handles `409` provider-unconfigured.
2. `src/components/billing/active-add-ons-list.tsx` — the subscription's `add_ons[]`, each with a "stop renewing" action (`useCancelAddOn`, `DELETE /billing/add-ons/{id}/`) for recurring ones.
3. Entry point from Phase 2's `resource-usage-row` (a "buy more" affordance next to a near/over-limit resource), role-gated.
4. `src/hooks/billing/use-purchase-add-on.ts` + `use-cancel-add-on.ts` — invalidate subscription + usage on success.

Spec use-case: Use-case 3 (Organization buys more of a pre-paid resource).

Tests:

- **Unit**: `purchase-add-on-dialog.test.tsx` — sends resource/quantity/recurring + token + idempotency key; shows pending until `is_active` flips; `409` renders provider-unavailable.
- **Unit**: `active-add-ons-list.test.tsx` — recurring add-ons expose "stop renewing" and call `DELETE`; one-time packs do not.
- **Integration**: usage row's "buy more" opens the dialog pre-selected to that resource; hidden for members without the role.

**Suggested AI model**: Tier 3 — purchase mutation with the payment island + confirmation, plus the recurring-cancel action. IDs per tier in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml).

**Reusable skills**: `new-composition` (the dialog + add-ons list); `new-hook` (the two mutations).

Acceptance: an admin can buy capacity for a pre-paid resource, see pending until the add-on activates, then see the effective limit rise on the dashboard; a recurring add-on can be set to stop renewing; the "buy more" affordance is role-gated and resource-scoped.

~450 LoC.

---

### Phase 5 — Grace/restricted resolve-payment flow

**Goal**: an organization whose recurring payment failed (GRACE or RESTRICTED) can update its payment instrument and retry the charge from a dedicated recovery surface, returning to ACTIVE without contacting support. Delivers the recovery direction of Use-case 5.

**Feature flag**: none — new route/action over existing endpoints.

Changes:

1. `src/app/(app)/billing/resolve-payment/page.tsx` — the recovery surface, reached from the Phase 2 billing-state banner when `billing_state` is `GRACE` / `RESTRICTED`. Shows the grace deadline (`grace_period_ends_at`), the current plan being kept, and a re-attach-instrument form — deliberately distinct from the plan picker, since the intent is "fix my payment", not "choose a new plan".
2. `src/components/billing/resolve-payment-form.tsx` — embeds `PaymentInstrumentField` (Phase 1) to capture a fresh instrument, then drives the retry and enters `useAwaitPaymentConfirmation`, polling until `billing_state` returns to `ACTIVE`.
3. **Mechanism + API-gap note (call out at review):** the API exposes **no dedicated "update payment method" or "retry dunning charge" endpoint** to clients — dunning retries are server-side (`DunningService`), and recovery to ACTIVE happens when any subscription charge confirms `APPROVED` (`_apply_subscription_payment_side_effects` → `resolve_payment_success`). The only client-facing write that re-attaches an instrument and re-initiates a charge is `change-plan`. So this dedicated flow **re-affirms the current plan** via `useChangePlan` (Phase 3) with the same `plan_slug`/`billing_interval`, a **new** `payment_token`, and a fresh per-attempt `idempotency_key`. The UI is purpose-built for recovery; the transport is the existing change-plan endpoint. If the API later adds a first-class update-instrument endpoint, only this form's mutation swaps — the surface does not.
4. Role-gated to billing-owner/admin (admin client-side + `403` backstop).

Spec use-case: Use-case 5 (Payment fails and the organization degrades) — the Grace/Restricted → Active recovery path.

Tests:

- **Unit**: `resolve-payment-form.test.tsx` — captures a new instrument and calls `change-plan` re-affirming the current plan with the new token + a fresh idempotency key; polls until `billing_state` is ACTIVE; renders the grace deadline; a retried submit reuses the same idempotency key.
- **Integration**: `resolve-payment/page.test.tsx` — an ACTIVE org visiting the route is redirected to `/billing` (nothing to resolve); a GRACE org sees the form; a member without the role sees the access-denied state.

**Suggested AI model**: Tier 3 — a money-path recovery flow riding change-plan with the payment island + confirmation polling and a redirect guard. IDs per tier in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml).

**Review models**: reviewer Tier 3 — dunning recovery is money-adjacent and the "re-affirm current plan" mechanism is subtle; a bug that changes the plan instead of re-affirming it, or reports recovery before the webhook lands, has real billing consequences. Fixer left on the project default.

**Reusable skills**: `new-page` (recovery route); `new-composition` (the form); the Phase 3 `useChangePlan` hook is reused, not re-authored.

Acceptance: a GRACE/RESTRICTED org can submit a new instrument, see a pending state, and return to ACTIVE once the charge confirms — from a dedicated recovery surface that keeps the current plan; an ACTIVE org is redirected away; the retry reuses one idempotency key.

~350 LoC.

---

### Phase 6 — Billing profile (tax / payer identity) management

**Goal**: an org admin creates and maintains the organization's billing profile (tax document number, payer identity, billing address). Bundled: the create/read/update of one profile.

**Feature flag**: none — new form over existing endpoints.

Changes:

1. `src/app/(app)/billing/profile/page.tsx` — renders the profile form from `useBillingProfile`.
2. `src/components/billing/billing-profile-form.tsx` — react-hook-form + zod form covering the `BillingProfile` fields + nested billing address; create-vs-update decided by whether a profile exists (`409` on duplicate create handled gracefully). Org-admin gated.
3. `src/hooks/billing/use-create-billing-profile.ts` + `use-update-billing-profile.ts` (PATCH) — invalidate the profile query on success.

Spec use-case: supports Use-case 3 / objective 2 (a payer identity is needed to take money) — the profile the charge is billed against.

Tests:

- **Unit**: `billing-profile-form.test.tsx` — zod validation on required tax/identity fields; create path on no existing profile, update path when one exists; a non-admin sees a read-only view.
- **Integration**: `profile/page.test.tsx` — renders existing profile values; `409` on duplicate create surfaces "a profile already exists".

**Suggested AI model**: Tier 2 — a react-hook-form + zod form following an established form pattern. IDs per tier in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml).

**Reusable skills**: `new-page` (profile route); `new-composition` (the form); `new-hook` (the two mutations).

Acceptance: an org admin can create and edit the billing profile with validated fields; a non-admin sees it read-only; duplicate-create is handled without an unhandled error.

~350 LoC.

---

### Phase 7 — Closed-period statement history (list + detail)

**Goal**: an organization lists its closed billing periods and opens any one to see what was counted and charged that cycle. Bundled: list + detail share a serializer tree and query domain (and the requester opted into bundling).

**Feature flag**: none — new read routes.

Changes:

1. `src/app/(app)/billing/periods/page.tsx` — paginated statement list from `useBillingPeriods` (newest first), with the API's `billing_period_start` / `charged` filters; an org with no closed periods renders an explicit empty state (not an error — history is forward-only).
2. `src/app/(app)/billing/periods/[id]/page.tsx` — one statement's detail from `useBillingPeriod(id)`: overage total, whether charged, plan snapshot, and the per-resource `resources[]` breakdown; `total: null` renders as "not recorded", never `0`. A pk outside the pool (`404`) routes to a not-found state.
3. `src/components/billing/` — `period-statement-list.tsx`, `period-statement-detail.tsx`, `period-resource-row.tsx` (reuses the by-organization breakdown component from Phase 2).

Spec use-case: Use-case 8 — the historical read the API's original spec deferred and the usage-summary plan added.

Tests:

- **Unit**: `period-resource-row.test.tsx` — `total: null` shows "not recorded"; `total: 0` shows `0`; the two are visibly distinct.
- **Integration**: `periods/page.test.tsx` — list is newest-first and filters narrow it; empty history is a clean empty state. `periods/[id]/page.test.tsx` — detail renders all resource rows and no reconciliation data (the API never serializes it); an out-of-pool id is not-found.

**Suggested AI model**: Tier 2 for the list/detail compositions, stepping to Tier 3 for the two routes' data loading + filter wiring. IDs per tier in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml).

**Reusable skills**: `new-page` (both routes); `new-composition` (the statement components); `add-storybook-story`.

Acceptance: `/billing/periods` lists closed statements newest-first with working date/charged filters and a clean empty state; `/billing/periods/{id}` shows the per-resource breakdown with `null` distinct from `0`; an out-of-pool id is a not-found, never a crash.

~450 LoC.

---

### Phase 8 — Metered-occurrence ledger

**Goal**: a billing owner or admin pages through every metered occurrence behind the org's post-paid charges — filtered to a period, filterable by allowance side / org / date — so an invoice dispute can be tied to specific occurrences. Line-item audit surface.

**Feature flag**: none — new read route.

Changes:

1. `src/app/(app)/billing/occurrences/page.tsx` — the paginated ledger from `useOccurrenceLedger`, defaulting to the current period; filters for `billing_period_start`, `is_within_allowance` (overage-only toggle), `organization` (within the pool), and an `occurrence_start` date range; ordering `-occurrence_start`. Uses the API's `LimitOffset` pagination (max 1000).
2. `src/components/billing/occurrence-ledger-table.tsx` + `occurrence-ledger-row.tsx` — per row: organization, event (title = series-root; `event: null` renders "event deleted" with the charge intact), calendar, owners, occurrence start, allowance side, unit price.
3. **Role gating**: the route/nav entry is billing-owner/admin only; a member who reaches it (or whose client-side role signal is wrong) gets the server `403` rendered as a "you don't have billing access" state rather than a raw error.
4. Reuses `src/lib/billing/format.ts` for money + datetime formatting.

Spec use-case: Use-case 8 — taken to line-item granularity so a customer can audit, not only observe.

Tests:

- **Unit**: `occurrence-ledger-row.test.tsx` — a deleted-event row shows "event deleted" and keeps its `unit_price`; the series-root-title caveat is surfaced.
- **Integration**: `occurrences/page.test.tsx` — the overage-only filter, period filter, and date range narrow the list; an `organization` filter outside the pool surfaces the API validation error, not an empty list; a non-billing member sees the 403 access state, not the table.

**Suggested AI model**: Tier 3 — a paginated, multi-filter table with role gating and nullable cross-entity enrichment. IDs per tier in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml).

**Review models**: reviewer Tier 3 — this surface exposes calendar content (event titles, owners) across the pooled subtree; the role gate and the pool-scoped org filter are the boundary that must not leak. Fixer left on the project default.

**Reusable skills**: `new-page` (ledger route); `new-composition` (the table); `add-storybook-story`.

Acceptance: a billing owner can page the current period's occurrences, filter to overage-only, and see each row tied to an occurrence (with deleted events rendered as `null`); a non-billing member gets a clear access-denied state; an out-of-pool org filter surfaces the validation error.

~450 LoC.

---

### Phase 9 — Entry-point wiring: sidebar nav + over-limit deep-links

**Goal**: billing becomes reachable from the app, and hitting a limit finally has a destination. This is the one phase that touches **existing** surfaces. Ship value: the billing area, until now reachable only by direct URL, is discoverable and actionable.

**Feature flag**: none — the changes are conditional-render additions; when the billing data layer resolves, the entries appear, else nothing changes.

Changes:

1. [`src/components/navigation/app-sidebar.tsx`](src/components/navigation/app-sidebar.tsx) — add a "Billing" nav section (Overview / Plans / Add-ons / Statements / Ledger / Profile), each item role-gated (ledger + write areas billing-owner/admin; reads open to members). Colocated story/test updated.
2. [`src/components/calendar-groups/over-limit-alert.tsx`](src/components/calendar-groups/over-limit-alert.tsx) — replace the "Deliberately no upgrade link" comment + behavior with a deep-link into `/billing` (to the plan picker for a pre-paid block, or the add-on dialog for the hit resource), passing the `resource` from the `402` body. Its test/story updated to assert the link target.
3. Any other consumer of `readOverLimitError` ([`src/lib/utils/api-errors.ts`](src/lib/utils/api-errors.ts)) gains the same destination via a shared "upgrade path" helper, so the deep-link is defined once.

Spec use-case: Use-case 8 (being blocked is never the first signal) + Use-case 2's "the way forward is to buy more / upgrade" made actionable in the UI.

Tests:

- **Unit**: `app-sidebar.test.tsx` — billing items render for an admin; the ledger/write items are hidden for a plain member; reads remain visible.
- **Unit**: `over-limit-alert.test.tsx` — the alert now renders an upgrade/purchase link targeting `/billing` with the offending `resource`; the prior "no link" assertion is replaced.

**Suggested AI model**: Tier 2 — nav wiring + a deep-link helper against established components; touches existing files so it carries the usual regression tests. IDs per tier in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml).

**Reusable skills**: `new-composition` (the shared upgrade-path helper); `add-storybook-story` (updated sidebar/alert stories).

Acceptance: the sidebar exposes role-appropriate billing entries; the calendar-groups over-limit alert deep-links into the billing surface carrying the blocked resource; the previously-linkless alert test now asserts the destination.

~300 LoC.

---

No flag-removal phase: no flag was introduced (see **Guiding Decisions**).

## 6. Risk & Rollout Notes

**No feature flag.** The frontend has no flag framework and every phase is additive new surface; the sole existing-surface touch (Phase 9) is conditional-render wiring. Rollback for any phase is a plain revert — Phases 0–8 add routes/hooks nothing else reads, and Phase 9 removes two entry points. There is no data to migrate and no server behavior to gate.

**The riskiest phase is Phase 1 (payment tokenization), and it is not a route.** It integrates two external provider SDKs and encodes the async-confirmation contract. A bug that declares success before the provider webhook lands mis-grants capacity or reports a charge that did not settle; a tokenization bug leaks or mis-mints an instrument. Mitigations: it is a standalone primitive with a reviewer Tier-4 step-up, both providers are tested behind one component contract, and the confirmation hook is unit-tested for the timeout/unmount races. It ships before any flow consumes it.

**Async confirmation is the cross-cutting hazard for Phases 3, 4, and 5.** `POST /billing/add-ons/` returns `201` and `change-plan` returns with `pending_*` set _before_ the charge confirms — capacity/plan grant (and dunning recovery to ACTIVE) happens on a provider webhook the frontend never sees directly. Every purchase/recovery flow must therefore end in a polled pending state (Phase 1's `useAwaitPaymentConfirmation`, bounded ~3s/~60s) and must never render "done" off the initiate response alone. The plan encodes this once and reuses it; a phase that shortcuts it is a review-blocking defect.

**Idempotency is the frontend's job to preserve.** The API is idempotent per `idempotency_key`, but only if the client reuses the same key across retries of one attempt. The `src/lib/billing/idempotency.ts` helper (Phase 0) and its test are the guard; double-click and network-retry cases are explicit test cases in Phases 3, 4, and 5.

**No client endpoint for "update payment method" / dunning retry.** The API's client surface has no first-class way to re-attach an instrument or force a dunning retry; recovery to ACTIVE is webhook-driven server-side. Phase 5's dedicated recovery flow therefore rides `change-plan` re-affirming the _current_ plan with a new token (see that phase). Called out because it is a real API-shape constraint, not a UI choice: if a first-class endpoint lands later, Phase 5's mutation swaps and the surface is unchanged. Worth confirming with the API team that re-affirming the current plan via `change-plan` while in GRACE reliably re-initiates the charge.

**Schema drift is a deploy-ordering constraint.** Phase 0 depends on the API's billing usage/periods/occurrences endpoints already being deployed and present in `schema.yml`. They are merged on the API side (the usage-summary plan's Phases 0–5). If the frontend `schema.yml` is re-synced against an API build that predates them, codegen silently omits the operations and later phases fail to typecheck — a fast, safe failure, but call it out: re-sync against a schema that contains `billing/usage/periods` and `billing/usage/occurrences` before starting.

**Role gating is defense-in-depth, not the gate.** The UI hides ledger + write affordances using the client-side membership-role signal, but the server's `403`/permission checks are the real boundary. Every gated surface renders a friendly access-denied state on a `403` so a wrong client signal degrades to "denied", never to a broken screen or a leaked affordance.

**External SDK loading & CSP.** Stripe.js / MercadoPago.js load from provider origins at runtime. If the app runs under a Content-Security-Policy, those script/connect origins must be allowed; verify the app's CSP (or add the provider origins) before Phase 1 ships, or the card field silently fails to mount. Flagged here because it is an environment concern the phase code cannot self-satisfy.

**Marketing narrative mismatch.** The public pricing page says "free / self-hosted, free forever". Shipping a paid-plan picker without reconciling that page is a product-messaging inconsistency, not a code defect — tracked in **Open Questions**, deliberately out of this plan's scope.

## 7. Open Questions

Every product/UX decision surfaced during interrogation was resolved before drafting; they are recorded as settled rows in **Guiding Decisions** (role gating = admin + `403` backstop; billing interval = both, monthly default; grace recovery = dedicated flow; confirmation poll = ~3s/~60s) and in the phase bodies (IA = top-level sidebar section, Phase 9; marketing pricing page = out of scope, per **Non-goals**).

One **engineering verification** remains — not a decision to be made, a fact to be confirmed with the API team, tracked in **Risk & Rollout Notes**: that re-affirming the current plan via `change-plan` while in `GRACE` reliably re-initiates the provider charge (the mechanism Phase 5's dedicated recovery flow relies on, since the API exposes no first-class update-instrument/retry endpoint). If it does not, Phase 5 needs either a new API endpoint (cross-repo) or an alternate transport, and this should be settled before Phase 5 starts.

## 8. Touch List

**Phase 0 — schema resync + client regen + read scaffolding**

- `schema.yml` — re-synced from the API repo (contains `billing/usage/periods`, `billing/usage/occurrences`, enriched `UsageResponse`)
- [`src/client/`](src/client/) — regenerated via `pnpm run openapi-ts` (never hand-edited)
- @src/hooks/billing/use-billing-usage.ts, use-billing-plans.ts, use-subscription.ts, use-payment-provider.ts, use-billing-profile.ts, use-billing-periods.ts, use-billing-period.ts, use-occurrence-ledger.ts (+ colocated tests)
- @src/lib/billing/format.ts, @src/lib/billing/idempotency.ts (+ tests)
- [`src/lib/utils/api-errors.ts`](src/lib/utils/api-errors.ts) — add `readBillingConflict()`
- @src/app/(app)/billing/layout.tsx, @src/app/(app)/billing/page.tsx (skeleton)

**Phase 1 — payment flow primitives**

- @src/components/billing/payment-instrument-field.tsx (+ test, stories)
- @src/hooks/billing/use-await-payment-confirmation.ts (+ test)
- @src/lib/billing/payment-token.ts
- env/config for provider SDK script URLs (`add-env-var`)

**Phase 2 — usage dashboard**

- @src/app/(app)/billing/page.tsx (real content; + test)
- @src/components/billing/billing-state-banner.tsx, plan-summary-card.tsx, resource-usage-list.tsx, resource-usage-row.tsx, overage-estimate.tsx, usage-by-organization.tsx (each + test + stories)

**Phase 3 — plan management**

- @src/app/(app)/billing/plans/page.tsx (+ test)
- @src/components/billing/change-plan-dialog.tsx, cancel-subscription-dialog.tsx (+ tests)
- @src/hooks/billing/use-change-plan.ts, use-cancel-subscription.ts (+ tests)

**Phase 4 — add-ons**

- @src/components/billing/purchase-add-on-dialog.tsx, active-add-ons-list.tsx (+ tests)
- @src/hooks/billing/use-purchase-add-on.ts, use-cancel-add-on.ts (+ tests)
- [resource-usage-row.tsx](src/components/billing/resource-usage-row.tsx) — add role-gated "buy more" affordance

**Phase 5 — grace/restricted resolve-payment**

- @src/app/(app)/billing/resolve-payment/page.tsx (+ test)
- @src/components/billing/resolve-payment-form.tsx (+ test)
- reuses [use-change-plan.ts](src/hooks/billing/use-change-plan.ts) + `PaymentInstrumentField` + `useAwaitPaymentConfirmation` (no new hook authored)

**Phase 6 — billing profile**

- @src/app/(app)/billing/profile/page.tsx (+ test)
- @src/components/billing/billing-profile-form.tsx (+ test)
- @src/hooks/billing/use-create-billing-profile.ts, use-update-billing-profile.ts (+ tests)

**Phase 7 — period statements**

- @src/app/(app)/billing/periods/page.tsx, @src/app/(app)/billing/periods/[id]/page.tsx (+ tests)
- @src/components/billing/period-statement-list.tsx, period-statement-detail.tsx, period-resource-row.tsx (+ tests + stories)

**Phase 8 — occurrence ledger**

- @src/app/(app)/billing/occurrences/page.tsx (+ test)
- @src/components/billing/occurrence-ledger-table.tsx, occurrence-ledger-row.tsx (+ tests + stories)

**Phase 9 — entry-point wiring**

- [`src/components/navigation/app-sidebar.tsx`](src/components/navigation/app-sidebar.tsx) — Billing nav section (+ updated test/story)
- [`src/components/calendar-groups/over-limit-alert.tsx`](src/components/calendar-groups/over-limit-alert.tsx) — deep-link into billing (+ updated test/story)
- [`src/lib/utils/api-errors.ts`](src/lib/utils/api-errors.ts) — shared "upgrade path" destination helper
