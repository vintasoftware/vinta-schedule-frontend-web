# Tracking — Billing Hardening Gap Closure

- **Plan:** `ai-plans/2026-08-13-BILLING_HARDENING_GAP_CLOSURE_IMPLEMENTATION_PLAN.md`
- **Plan id:** `billing-hardening-gap-closure`
- **Started:** 2026-08-17
- **Last updated:** 2026-08-17
- **Feature flag:** none (repo has no flag framework; shipped billing merged flagless)

## Run options
- `pause_between_phases`: false (auto-flow)
- `generate_inline_comments`: false
- `full_test_suite`: true (Full — whole suite each phase)
- `run_e2e`: false (no e2e specs in this plan)
- `commit_strategy_resolved`: stacked-branches
- `use_worktree`: true
- `worktree_path`: `/Users/hugobessa/Workspaces/vinta-schedule-frontend-web/.claude/worktrees/plan-billing-hardening-gap-closure`
- `worktree_branch`: `plan-billing-hardening-gap-closure` (base branch; forks `origin/main` @ 9f6a4d8)
- `worktree_summary`: `.vinta-ai-workflows/worktrees/plan-billing-hardening-gap-closure.yaml`
- `sandbox_tier`: enforced

## Agent models (from `.vinta-ai-workflows.yaml`)
- reviewer: Tier 3 (Phases 7 & 8 override to Tier 4)
- fixer: Tier 2
- worktree_prep: Tier 1 (done)
- integrate: Tier 1

## Branch topology (stacked)
- phase-0 → base `plan-billing-hardening-gap-closure`
- phase-N → base `plan/billing-hardening-gap-closure/phase-{N-1}`

## Completed phases

### Phase 0 — Schema refresh + client regeneration ✅
- **Status:** PASS (review clean)
- **Branch:** `plan/billing-hardening-gap-closure/phase-0` (base: `plan-billing-hardening-gap-closure` = origin/main @ 9f6a4d8; PR base on GitHub: `main`)
- **Implementer model:** Tier 1 (haiku, plan-suggested T1)
- **Reviewer model:** Tier 3 (sonnet) · **Fixer model:** Tier 2 (haiku)
- **Commits:** `44b7502` chore(client): refresh schema + regen hey-api client · `3dc7642` fix(billing): document_type consumer fixups (amended)
- **Summary:** Refreshed `schema.yml` from backend `~/Workspaces/vinta-schedule` (verified byte-identical to backend `origin/main` — no unreviewed groups/permissions surface leaked in; regen added only the two `billing_subscription_retry_payment_create` operations + `BillingProfileDocumentTypeEnum` + 4 incidental membership-in-description prose lines). Regenerated `src/client/*`. Mechanical consumer fixups: `document_type` fixtures `tax_id`→`SSN` across 5 test/story files (forced by the enum type) + a single `as BillingProfileDocumentTypeEnum` cast in `toWritable`.
- **Review note:** reviewer flagged a BLOCKER — the implementer had prematurely tightened the profile-form zod `document_type` to the 9-value enum union while the field is still free-text (Phase 4 scope + untested UX regression). Fixed by reverting to `z.string().min(1)`; the cast alone satisfies typecheck. Phase 0 is now behavior-neutral.
- **Gate:** typecheck clean (app + DS); full suite green (app 222 files/1758 tests, DS 11/82). The "5 calendar-groups timeout failures" the implementer saw were flaky/environmental — passed on clean re-run.

## Current phase
- **Phase 1 — Hardened billing error-code discrimination** (next)

## Remaining phases
- Phase 1 — Hardened billing error-code discrimination (T2)
- Phase 2 — Billing read-surface polish (T3)
- Phase 3 — App-wide billing-state banner (T3)
- Phase 4 — Billing profile form hardening (T3)
- Phase 5 — Downgrade-vs-upgrade distinction (T3)
- Phase 6 — Payment-provider unsupported fallback (T2/T3)
- Phase 7 — Grace recovery via real retry-payment (T3, reviewer T4)
- Phase 8 — Global over-limit handler + remedy routing (T3, reviewer T4)

## Deferred phases
_(none — no cross-repo, no flag-removal)_
