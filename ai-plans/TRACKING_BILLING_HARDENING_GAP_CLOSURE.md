# Tracking — Billing Hardening Gap Closure

- **Plan:** `ai-plans/2026-08-13-BILLING_HARDENING_GAP_CLOSURE_IMPLEMENTATION_PLAN.md`
- **Plan id:** `billing-hardening-gap-closure`
- **Started:** 2026-08-17 · **Last updated:** 2026-08-17
- **Feature flag:** none

## 2026-08-17 — rebased onto origin/main after PR #113 merged
PR #113 (`membership role → permissions capability model`) landed on `main`. It (1) regenerated the whole client from a schema that already carries the billing hardening, and (2) replaced role gating (`useRole`/`role-gate.tsx`) with the capability model (`useHasPermission(PERMISSIONS.manageBilling)` / `permission-gate.tsx` / `src/lib/permissions.ts`).
- **Base advanced:** `plan-billing-hardening-gap-closure` now = `origin/main` @ 9f409f3.
- **Phase 0 dropped** as redundant (client already regenerated on main). PR #112 closed.
- **Phase 1** replayed clean onto origin/main (new sha `80f5aca`); PR #114 re-targets `main`.
- **Phase 2** rebased; conflicts resolved in `billing-plans-picker.tsx` (merged currency/limits/entitlements with #113's capability gating) and its test migrated `RoleProvider` → `PermissionProvider`.
- **Later phases (3/4/8):** gate on `payments.manage_billing`, not role; re-confirm call sites against #113's reworked `app-layout-client` / `team-table` / calendar-groups.

## Run options
- pause_between_phases: false · generate_inline_comments: false · full_test_suite: true · run_e2e: false
- commit_strategy_resolved: stacked-branches
- use_worktree: true · worktree_path: `.claude/worktrees/plan-billing-hardening-gap-closure`
- worktree_branch (base): `plan-billing-hardening-gap-closure` (= origin/main @ 9f409f3)
- sandbox_tier: enforced (in-process subagents rely on the review-phase stray-write backstop)

## Agent models
- reviewer T3 (Phases 7 & 8 → T4) · fixer T2 · worktree_prep T1 · integrate T1

## Branch topology (stacked, post-rebase)
- phase-1 → base `origin/main`
- phase-N → base `plan/billing-hardening-gap-closure/phase-{N-1}`

## Completed phases

### Phase 0 — REMOVED (superseded by PR #113)
Client regen no longer needed; `main` already has `billingSubscriptionRetryPaymentCreate`, `BillingProfileDocumentTypeEnum`, and the `document_type` cast. PR #112 closed as redundant.

### Phase 1 — Hardened billing error-code discrimination ✅
- **Status:** PASS · **Branch:** `plan/billing-hardening-gap-closure/phase-1` (base: origin/main) · PR [#114](https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/114)
- **Models:** impl T2 (haiku) · reviewer T3 · fixer T2 · **Commit (post-rebase):** `80f5aca`
- **Summary:** `src/lib/utils/api-errors.ts` now discriminates all ten stable billing codes via `readBillingErrorCode`, adds `readFieldValidationErrors` (incl. nested `billing_address.*` dotted keys), removes the `detail`/`message` substring fallbacks from `isPaymentTokenRequiredError`/`isAddOnNotPurchasableError`, and keeps `readOverLimitError` exposing `resource`. Two consumer test mocks gained the hardened `code` field.
- **Rebase note:** replayed clean onto origin/main (#113 did not touch api-errors).

### Phase 2 — Billing read-surface polish ✅ (rebased; review in progress at rebase time — re-reviewed on new base)
- **Status:** rebased green; final review pending · **Branch:** `plan/billing-hardening-gap-closure/phase-2` (base: phase-1) · **Commit:** `d435e40`
- **Models:** impl T3 (sonnet) · reviewer T3 · fixer T2
- **Summary:** `plan-summary-card` shows `billing_interval` + a pending-change line (only when `pending_plan_slug` set); `billing-plans-picker` filters the catalog to `subscription.plan.currency` and renders each plan's limits + enabled entitlements (new `entitlement-labels.ts`); `resource-usage-row` renders an explicit "not included" state for `limit_value === 0`. `billing-overview` threads the subscription into the summary card.
- **Rebase note:** resolved conflicts with #113's capability migration in `billing-plans-picker.tsx`; the new picker test uses `PermissionProvider`.

### Phase 3 — App-wide billing-state banner ✅
- **Status:** PASS · **Branch:** `plan/billing-hardening-gap-closure/phase-3` (base: phase-2) · **Commit:** `9d2ba40`
- **Models:** impl T3 (sonnet) · reviewer T3 · fixer T2
- **Summary:** New client wrapper `app-billing-banner.tsx` reads `useSubscription()` and renders `BillingStateBanner` for `grace`/`restricted`/`cancelled` (null for free/active/no-sub), mounted once in `app-layout-client.tsx` above `{children}` inside `<AppShell>` so it shows on every authenticated page. Removed the redundant in-section mount from `billing-overview.tsx`. Added colocated story + unit/integration tests (single-render on `/billing` asserted).
- **Review note:** no BLOCKER. SHOULD-FIX: original wrapper rendered only grace/restricted, dropping the `cancelled` surface entirely (the plan hides only free/active) → fixed to include `cancelled`; corrected a stale docstring; added the missing story; NIT flash comment. Behavior change (plan-sanctioned): `/billing` no longer shows the active/free informational banner.

### Phase 4 — Billing profile form hardening ✅
- **Status:** PASS · **Branch:** `plan/billing-hardening-gap-closure/phase-4` (base: phase-3) · **Commit:** `14f2a7e`
- **Models:** impl T3 (sonnet) · reviewer T3 · **fixer T3 (sonnet, bumped for two BLOCKERs touching hook error-plumbing)**
- **Summary:** `document_type` is now a `Select` over the nine `BillingProfileDocumentTypeEnum` values (zod `z.enum`); the read view shows the friendly `DOCUMENT_TYPE_LABELS` with a legacy raw fallback (open-on-read). Server field-validation 400s map per-field via `readFieldValidationErrors` → `setError` (incl. nested `billing_address.*`). The form is split into an outer gating `BillingProfileForm` + a keyed `BillingProfileEditor` (id-keyed remount replaces the old `reset()`-effect, dodging a Radix-Select/jsdom prefill bug). New `document-type-labels.ts`.
- **Review note:** two BLOCKERs fixed. (1) `alreadyExists` state lived inside the keyed editor → destroyed on the 409→refetch remount (banner vanished); lifted to the outer component + regression test. (2) the 403 was detected by exact `detail` text (the anti-pattern Phase 1 removed) → the two hooks now call the raw op with `throwOnError:false` and attach HTTP `status`; new `readErrorStatus` + the form branches on `status === 403`. SHOULD-FIX: read-view label map; prefill + remount tests. NIT: FieldPath cast comment.
- **Gate:** typecheck clean; full suite green (app 224/1821, DS 82).

### Phase 5 — Downgrade-vs-upgrade distinction ✅
- **Status:** PASS · **Branch:** `plan/billing-hardening-gap-closure/phase-5` (base: phase-4) · **Commit:** `a11d507`
- **Models:** impl T3 (sonnet) · reviewer T3 · **fixer T3 (sonnet, money-path BLOCKER)**
- **Summary:** `change-plan-dialog.tsx` no longer polls a scheduled downgrade to the "taking longer than usual" timeout. After initiate it branches on the response: `updated.pending_plan_effective_at !== null` → a terminal "scheduled for {date}" state, no poll; null → the existing charge/upgrade poll unchanged. `billing-plans-picker.tsx` labels each card "Downgrade"/"Upgrade" mirroring the backend's interval semantics (current plan at the subscription's own interval vs target at the toggle interval).
- **Review note:** the reviewer read the backend service and caught a money-path BLOCKER — the original client-side price heuristic (both plans at the target interval) disagreed with the backend (current-own-interval vs target-requested-interval), so a cross-interval "cheaper" pick could skip the confirmation poll on an actually-charged upgrade (`pending_plan_effective_at=null`) and equal-price switches were misclassified. Fixed by branching on the authoritative response field instead of client price math; `isDowngrade`/`planPrice` deleted from the dialog. Added response-driven regression tests.
- **Gate:** typecheck clean; full suite green (app 224/1828, DS 82).

### Phase 6 — Payment-provider unsupported fallback ✅
- **Status:** PASS (review clean, no fixes) · **Branch:** `plan/billing-hardening-gap-closure/phase-6` (base: phase-5) · **Commit:** `8109631`
- **Models:** impl T3 (sonnet) · reviewer T3 · fixer n/a
- **Summary:** Deleted the unverified/broken MercadoPago Secure-Fields adapter (+ its interfaces + `MERCADOPAGO_SDK_URL`) from `payment-provider-sdk.ts`. Added `createUnsupportedProviderSdk()` — inert `mount`/`unmount`, `tokenize()` returns `{ reason: 'unsupported_provider' }` (new reason on `PaymentInstrumentErrorReason` in `payment-token.ts`). The factory returns it for any non-stripe provider and never throws. `payment-instrument-field.tsx` renders a clear "not available" Alert for an unsupported provider (loading → unsupported → unavailable → mounted branch order) instead of mounting a dead form. Stripe path byte-unchanged. Net −168 lines.
- **Gate:** typecheck clean; full suite green (app 224/1822, DS 82).

## Current phase
- **Phase 7 — Grace recovery via real retry-payment** (next; reviewer T4)

## Remaining phases
- Phase 4 — Billing profile form hardening (T3) — capability-gated
- Phase 5 — Downgrade-vs-upgrade distinction (T3)
- Phase 6 — Payment-provider unsupported fallback (T2/T3)
- Phase 7 — Grace recovery via real retry-payment (T3, reviewer T4)
- Phase 8 — Global over-limit handler + remedy routing (T3, reviewer T4) — capability-gated; re-confirm #113-reworked surfaces

## Deferred phases
_(none — no cross-repo, no flag-removal)_
