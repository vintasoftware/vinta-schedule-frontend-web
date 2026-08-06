# Tracking — ORGANIZATION_AUTH_BRANDING

- **Feature**: Organization Auth-Area Branding (Frontend)
- **Plan**: `ai-plans/2026-08-05-ORGANIZATION_AUTH_BRANDING_IMPLEMENTATION_PLAN.md`
- **Started**: 2026-08-05
- **Last updated**: 2026-08-06

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
- **PR**: https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/77

### Phase 1 — Honor OAuth `destination`; delete `validateReturnUrl` ✅
- **PR**: https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/78

### Phase 2 — Branding form: `redirect_url` replaces allowlist ✅
- **PR**: https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/81

### Phase 3 — Gate Branding on `can_manage_branding` ✅
- **PR**: https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/91

### Phase 4 — Slug field on the branding page ✅

- **Status**: published
- **Model**: implementer `composer-2.5-fast`; reviewer `cursor-grok-4.5-high`; fixer n/a
- **Branch**: `plan/organization-auth-branding/phase-4`
- **Base**: `plan/organization-auth-branding/phase-3`
- **PR**: https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/92
- **PR-context**: `.vinta-ai-workflows/prs-context/organization-auth-branding/phase-4.md` (`status: published`)
- **E2E**: n/a
- **Summary**: `useUpdateOrganizationSlug` + branding form slug field; PATCH-then-PUT; empty → null; orphan warning; reserved/uniqueness from server 400. Review PASS (NIT only). 49 scoped tests green.

## Current phase

Paused after Phase 4 — awaiting user confirmation before Phase 5.

## Remaining phases

- Phase 5 — Distinguishable branding write 403 UIs
- Phase 6 — Logo upload widget
- Phase 7 — Branded `/auth/login/[slug]/` route

## Deferred phases

_(none)_
