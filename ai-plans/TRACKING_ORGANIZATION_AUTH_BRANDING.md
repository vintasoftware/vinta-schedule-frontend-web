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
- **PR**: https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/77
- **Branch**: `plan/organization-auth-branding/phase-0` (base `main`)

### Phase 1 — Honor OAuth `destination`; delete `validateReturnUrl` ✅

- **Status**: published
- **PR**: https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/78
- **Branch**: `plan/organization-auth-branding/phase-1` (base phase-0)

### Phase 2 — Branding form: `redirect_url` replaces allowlist ✅

- **Status**: published
- **PR**: https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/81
- **Branch**: `plan/organization-auth-branding/phase-2` (base phase-1)

### Phase 3 — Gate Branding on `can_manage_branding` ✅

- **Status**: published (pending PR open)
- **Model**: implementer `composer-2.5-fast`; reviewer `cursor-grok-4.5-high`; fixer `composer-2.5-fast`
- **Branch**: `plan/organization-auth-branding/phase-3`
- **Base**: `plan/organization-auth-branding/phase-2`
- **E2E**: n/a
- **Summary**: Nav + page gated on admin && `can_manage_branding`; Reseller group removed; deep link redirects to `/`. Fixer required admin because GET `/branding/` is admin-gated and `can_manage_branding` is org-level (true for members too). 20 scoped tests green.

## Current phase

Paused after Phase 3 — awaiting user confirmation before Phase 4.

## Remaining phases

- Phase 4 — Slug field on the branding page
- Phase 5 — Distinguishable branding write 403 UIs
- Phase 6 — Logo upload widget
- Phase 7 — Branded `/auth/login/[slug]/` route

## Deferred phases

_(none)_
