# Tracking — ORGANIZATION_AUTH_BRANDING

- **Feature**: Organization Auth-Area Branding (Frontend)
- **Plan**: `ai-plans/2026-08-05-ORGANIZATION_AUTH_BRANDING_IMPLEMENTATION_PLAN.md`
- **Started**: 2026-08-05
- **Last updated**: 2026-08-05

## Run options

- `pause_between_phases`: true
- `generate_inline_comments`: false
- `full_test_suite`: false
- `run_e2e`: false
- `use_worktree`: false
- `commit_strategy_resolved`: stacked-branches
- `WORKROOT`: `/home/arthur/Projects/vinta-schedule-frontend-web`
- `BASE_BRANCH`: `main`
- `SANDBOX_TIER`: none

## Completed phases

### Phase 0 — Sync schemas and regenerate clients ✅

- **Status**: review PASS; integrating
- **Model**: implementer `composer-2.5-fast` (plan Tier 1); reviewer `claude-sonnet-5-thinking-high` (agent_models.reviewer Tier 3); fixer n/a
- **Branch**: `plan/organization-auth-branding/phase-0`
- **Base**: `main`
- **E2E**: skipped (`run_e2e = false`)
- **Summary**: Copied backend `schema.yml`, regenerated REST client. Types now have `redirect_url` on branding and `can_manage_branding` on memberships; `OrganizationBrief.slug` is `string | null`. Minimal compile fixes: branding form allowlist → single `redirect_url` input (Phase 2 owns full validation); fixture updates; `KindEnum` → `ExternalEventChangeRequestKindEnum`. `schema-auth.yml` unchanged vs HEAD — no `destination` field (Phase 1 hand-extends). Typecheck + scoped tests green.

## Current phase

Paused after Phase 0 — awaiting user confirmation before Phase 1.

## Remaining phases

- Phase 1 — Honor OAuth `destination`; delete `validateReturnUrl`
- Phase 2 — Branding form: `redirect_url` replaces allowlist
- Phase 3 — Gate Branding on `can_manage_branding`
- Phase 4 — Slug field on the branding page
- Phase 5 — Distinguishable branding write 403 UIs
- Phase 6 — Logo upload widget
- Phase 7 — Branded `/auth/login/[slug]/` route

## Deferred phases

_(none — no cross-repo or flag-removal phases)_
