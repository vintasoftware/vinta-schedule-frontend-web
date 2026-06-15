# Tracking — Multi-Organization Support

- **Plan**: [ai-plans/2026-06-15-MULTI_ORGANIZATION_SUPPORT_IMPLEMENTATION_PLAN.md](2026-06-15-MULTI_ORGANIZATION_SUPPORT_IMPLEMENTATION_PLAN.md)
- **Plan id**: MULTI_ORGANIZATION_SUPPORT
- **Branch pattern**: `plan/multi-organization-support/phase-{id}`
- **Started**: 2026-06-15
- **Last updated**: 2026-06-15

## Run options

- `pause_between_phases`: false (auto-flow)
- `generate_inline_comments`: true
- PR policy: agents create PRs via prs-context + open-pr.sh

## Environment notes

- **Baseline (pre-implementation)**: typecheck clean; full suite 728 passed / 76 files.
- **Dirty-tree decision**: an uncommitted client regen (schema.yml + src/client/\* + auth-client) was
  folded into the **Phase 1 base** (commit `chore(client): regenerate API client…`). An unrelated
  **notifications WIP** (app-topbar, app-layout-client, service-account-card, use-service-account,
  untracked notifications/ dirs) is left riding in the working tree per user decision — must NOT be
  staged into any phase commit. Watch for it in `git status`; stage explicitly only.
- **Phase 0 (regen)**: folded into Phase 1 base; no separate Phase 0 PR.

## Feature flag

None — shipped unflagged (Guiding Decisions). No flag-removal phase.

## Completed Phases

### Phase 1 — Active-org store + header injection (inert) ✅

- **Status**: merged-ready; PR [#45](https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/45)
- **Branch**: `plan/multi-organization-support/phase-1` (base `main`)
- **Model**: Tier 2 → `claude-haiku-4-5` (impl); fix-up by `claude-sonnet-4-6`
- **Commits**: `chore(client): regenerate API client…` (folded Phase 0 base) · `docs(plans): add plan` · `feat(api-client): Inject X-Organization-Id…` · `test(api-client): Drive real interceptor…`
- **Summary**: New module-level `src/lib/active-organization.ts` store (sync, subscribable,
  localStorage-backed, SSR-safe, string ids). Request interceptor on `client` injects
  `X-Organization-Id` from the store iff a selection exists, inside the existing `configured`
  StrictMode guard, browser-only. Unflagged-safe: no selection ⇒ no header ⇒ prior behavior.
- **Review note**: reviewer caught vacuous tests (reimplemented logic, never drove the real
  interceptor); fixer rewrote them to drive a real request through `client` via mock fetch +
  dynamic-import module isolation, verified non-vacuity. Outer gate: typecheck clean, 745 tests.
- **Orchestrator note**: reverted ~16 files of unrelated repo-wide `format:fix` churn the impl
  agent produced (main is not prettier-clean). Going forward, agents run prettier scoped to their
  own files only — never `npm run format:fix`.

## Current Phase

- **Phase 2 — `useMyOrganizations` hook (`mine/`)** — starting.

## Remaining Phases

- Phase 3a — Active-org selection hook + bootstrap
- Phase 3b — Login-time org selection gate + auth page
- Phase 4 — Sidebar org switcher dropdown
- Phase 5 — Create another organization from the switcher
- Phase 6 — Gated onboarding drives off `mine/`
- Phase 7 — Accept invitation into an additional org
- Phase 8 — Recover from 400 (header required)
- Phase 9 — Recover from 403 (stale active org)

## Deferred Phases

_(none — no cross-repo or flag-removal phases in this plan)_
