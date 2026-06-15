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
- **Dirty-tree decision (revised)**: the uncommitted client regen (schema.yml + src/client/\* +
  auth-client) was folded into the **Phase 1 base**. The WIP that rode in the tree split two ways:
  - **service-account** (`service-account-card.*`, `use-service-account.*`) was **regen reconciliation**
    — backend renamed `audience` → `admin_email`; the committed regen does NOT typecheck without it.
    Committed onto Phase 1 (`fix(service-accounts): Rename audience to admin_email…`, a5f4f68); Phase 2
    rebased on top; both force-pushed.
  - **notifications WIP** (`app-topbar.tsx`, `app-layout-client.tsx`, untracked `notifications/` dirs) is
    **stashed** (`stash@{0}` "notifications WIP (parked during multi-org plan)") for the plan's duration
    — it collided with app-layout-client.tsx edits in Phases 3a/3b/6/9. **Restore at plan end** via
    `git stash pop` of that entry (NOT `stash@{1}`, which belongs to another branch). Per user.
- **Phase 0 (regen)**: folded into Phase 1 base; no separate Phase 0 PR.
- **Format gate**: `main` is not prettier-clean, so repo-wide `npm run format` is red on pre-existing
  files. Agents run prettier scoped to their own files; the gate is per-file, not repo-wide.

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

### Phase 2 — `useMyOrganizations` hook (`mine/`) ✅

- **Status**: PR [#46](https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/46) (base: phase-1)
- **Branch**: `plan/multi-organization-support/phase-2`
- **Model**: Tier 2 → `claude-haiku-4-5`
- **Commit**: `feat(organizations): Add useMyOrganizations hook for mine endpoint`
- **Summary**: `src/hooks/organizations/use-my-organizations.ts` wraps `organizationsMineListOptions`,
  exports `MY_ORGANIZATIONS_QUERY_KEY`, derives `isGated`/`isMultiOrg`. Bare-array response.
- **Review**: reviewer clean (no BLOCKER/SHOULD-FIX). 3 NITs left as-is: flaky-prone timer in the
  `enabled:false` test (real proof is `not.toHaveBeenCalled`), unused `Response` in a mock helper,
  untyped `enabled` param. Outer gate: typecheck clean, 749 tests.

### Phase 3a — Active-org selection hook + bootstrap ✅

- **Status**: PR [#47](https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/47) (base: phase-2)
- **Branch**: `plan/multi-organization-support/phase-3a`
- **Model**: Tier 3 → `claude-sonnet-4-6` (impl + fix)
- **Commits**: `feat(organizations): Bootstrap active organization selection on load` · `refactor(organizations): Memoize setActive and harden bootstrap convergence`
- **Summary**: `useActiveOrganization` reads the store via `useSyncExternalStore`, derives
  `activeMembership`, bootstraps (single-org auto-resolve, stale self-heal in one write, multi-org
  left unset → `needsSelection`), exposes memoized `setActive` (store + invalidate-all). Mounted in
  `app-layout-client.tsx`; loading guard waits on `mine/`. No redirect yet (`void needsSelection`).
- **Review**: no BLOCKER. Reviewer verified no render-loop + no LoadingView deadlock. Fix-up:
  memoized setActive, collapsed stale-then-single into one write (no transient null), `waitFor`
  instead of flaky timer, added 2 convergence/no-loop tests (verified non-vacuous). 758 tests.
- **Note**: first agent turn was cut off mid-work; resumed same agent to finish + commit.

### Phase 3b — Login-time org selection gate + auth page ✅

- **Status**: PR [#48](https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/48) (base: phase-3a)
- **Branch**: `plan/multi-organization-support/phase-3b`
- **Model**: Tier 3 → `claude-sonnet-4-6` (impl + fix)
- **Commits**: `feat(organizations): Add login-time org selection gate and page` · `fix(organizations): Treat mine/ error as neutral on org-selection page`
- **Summary**: New `/auth/select-organization` page (outside `(app)`) lists memberships; pick →
  `setActive(String id)` + `/`. Guards: 0 → onboarding, single/valid → `/`, error → neutral. Gate
  effect in app-layout-client redirects `needsSelection` users; render guard includes it.
- **Review**: no BLOCKER; loop-safety confirmed (page outside `(app)`). Fix-up: handle `mine/`
  `isError` as neutral (don't bounce multi-org user to onboarding on a blip) + negative test
  assertions. 766 tests.

## Current Phase

- **Phase 4 — Sidebar org switcher dropdown** — starting.

## Remaining Phases

- Phase 4 — Sidebar org switcher dropdown
- Phase 5 — Create another organization from the switcher
- Phase 6 — Gated onboarding drives off `mine/`
- Phase 7 — Accept invitation into an additional org
- Phase 8 — Recover from 400 (header required)
- Phase 9 — Recover from 403 (stale active org)

## Deferred Phases

_(none — no cross-repo or flag-removal phases in this plan)_
