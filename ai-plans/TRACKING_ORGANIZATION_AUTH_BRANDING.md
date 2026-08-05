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

- **Status**: published
- **Model**: implementer `composer-2.5-fast` (plan Tier 1); reviewer `claude-sonnet-5-thinking-high` (agent_models.reviewer Tier 3); fixer n/a
- **Branch**: `plan/organization-auth-branding/phase-0`
- **Base**: `main`
- **PR**: https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/77
- **PR-context**: `.vinta-ai-workflows/prs-context/organization-auth-branding/phase-0.md` (`status: published`)
- **E2E**: skipped (`run_e2e = false`)
- **Summary**: Copied backend `schema.yml`, regenerated REST client. Types now have `redirect_url` on branding and `can_manage_branding` on memberships; `OrganizationBrief.slug` is `string | null`. Minimal compile fixes: branding form allowlist → single `redirect_url` input (Phase 2 owns full validation); fixture updates; `KindEnum` → `ExternalEventChangeRequestKindEnum`. `schema-auth.yml` unchanged vs HEAD — no `destination` field (Phase 1 hand-extends). Typecheck + scoped tests green.

### Phase 1 — Honor OAuth `destination`; delete `validateReturnUrl` ✅

- **Status**: published
- **Model**: implementer `claude-sonnet-5-thinking-high` (plan Tier 3); reviewer `claude-opus-5-thinking-high` (phase override Tier 4); fixer `claude-sonnet-5-thinking-high` (agent_models.fixer Tier 2)
- **Branch**: `plan/organization-auth-branding/phase-1`
- **Base**: `plan/organization-auth-branding/phase-0`
- **PR**: https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/78
- **PR-context**: `.vinta-ai-workflows/prs-context/organization-auth-branding/phase-1.md` (`status: published`)
- **E2E**: PR044 present, `test.skip` (no automatable IdP); Playwright not run (`run_e2e = false`)
- **Summary**: Callback uses server `destination` (hand-typed); removed `fetchValidatedReturnUrl` + allowlist/`next` landing logic. Hardened with trim + absolute/relative shape guard; adversarial leftover-`next` tests restored. Pending flows unchanged. Only remaining `validateReturnUrl` string in `src/` is the GraphQL introspection snapshot under `__generated__/`.

### Phase 2 — Branding form: `redirect_url` replaces allowlist ✅

- **Status**: published (pending PR open)
- **Model**: implementer `composer-2.5-fast`; reviewer `cursor-grok-4.5-high`; fixer `composer-2.5-fast` (Cursor models per user request)
- **Branch**: `plan/organization-auth-branding/phase-2`
- **Base**: `plan/organization-auth-branding/phase-1`
- **E2E**: n/a
- **Summary**: Full Zod for five handoff rules; label/help copy; page reseller wording updated. Fixer corrected empty-clear to send `""` in PUT body (not omit). 27 branding unit tests green.

## Current phase

Paused after Phase 2 — awaiting user confirmation before Phase 3.

## Remaining phases

- Phase 3 — Gate Branding on `can_manage_branding`
- Phase 4 — Slug field on the branding page
- Phase 5 — Distinguishable branding write 403 UIs
- Phase 6 — Logo upload widget
- Phase 7 — Branded `/auth/login/[slug]/` route

## Deferred phases

_(none — no cross-repo or flag-removal phases)_
