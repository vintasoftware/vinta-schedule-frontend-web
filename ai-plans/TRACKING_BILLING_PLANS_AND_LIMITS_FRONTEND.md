# Tracking — Billing Plans and Limits (Frontend)

- **Plan:** ai-plans/2026-08-11-BILLING_PLANS_AND_LIMITS_FRONTEND_IMPLEMENTATION_PLAN.md
- **Spec:** ai-plans/2026-08-11-BILLING_PLANS_AND_LIMITS_FRONTEND_SPEC.md
- **Started:** 2026-08-12
- **Last updated:** 2026-08-12
- **Feature flag:** none (by design — see plan Guiding Decisions)

## Run options
- pause_between_phases: false (auto-flow)
- generate_inline_comments: false
- full_test_suite: false (scoped tests per phase)
- run_e2e: false (plan ships no e2e specs)
- commit_strategy_resolved: stacked-branches
- use_worktree: true
- worktree_path: .claude/worktrees/plan-billing-plans-and-limits-frontend
- worktree_branch: plan/billing-plans-and-limits-frontend/wt
- worktree_summary: .vinta-ai-workflows/worktrees/plan-billing-plans-and-limits-frontend.yaml
- sandbox_tier: none (orchestrator session started in main checkout; relies on review-phase stray-write backstop)

## Agent models
- reviewer: Tier 3 (default); Tier 4 override on Phases 6, 9, 10
- fixer: Tier 2 (default)
- worktree_prep: Tier 1
- integrate: Tier 1

## Completed phases

### Phase 1 — Billing error-contract parsing layer ✅
- **Status:** merged-ready (reviewed, PASS)
- **Model:** implementer haiku (T2); reviewer sonnet (T3); fixer haiku (T2)
- **Branch:** plan/billing-plans-and-limits-frontend/phase-1 (base: plan/billing-plans-and-limits-frontend/wt)
- **Commits:** `285154b` feat(billing): add error-contract parsing layer · `be35591` fix(billing): validate remedy against known values in error parser
- **Files:** src/lib/billing/billing-errors.ts, src/lib/billing/billing-errors.test.ts
- **Summary:** `parseBillingError(unknown)` returns a discriminated union over four variants — `LimitExceededError` (`code:'limit_exceeded'` + resource/current_usage/limit/remedy), `CodedBillingError` (nine coded errors + detail), `FieldValidationError` (field-keyed, no code), and `UnrecognizedBillingError` fallback. Branches strictly on `code`, never `detail`. `billingErrorMessage` exposes `detail` for logging only. `ResourceKeyEnum` re-exported from the generated client (it exists there); `Remedy` and the coded-error codes hand-written because the generated client does NOT export them (`BillingErrorBody` is not a named codegen type either). Reviewer SHOULD-FIX applied: `isKnownRemedy` guard now validates `remedy` membership so an unknown remedy falls back to `unrecognized` (protects Phase 10's exhaustive remedy switch). 48 unit tests. typecheck + scoped suite green.

## Current phase
Phase 2 — Billing area shell, navigation, subscription read + state banner (next).

## Remaining phases
- Phase 2 — Billing area shell, navigation, subscription read + state banner (T3)
- Phase 3 — Plans catalog + usage meters (T2/T3)
- Phase 4 — Usage ledger & billing history (T3)
- Phase 5 — Billing profile create/edit (T3)
- Phase 6 — Payment provider abstraction + Stripe card tokenization (T4, reviewer T4)
- Phase 7 — Plan change & cancel (T3)
- Phase 8 — Capacity add-on purchase & stop (T3)
- Phase 9 — Grace recovery (retry-payment) & card replacement (T3, reviewer T4)
- Phase 10 — Global over-limit handler + remedy routing (T3, reviewer T4)

## Deferred phases
_None — no cross-repo or flag-removal phases._
