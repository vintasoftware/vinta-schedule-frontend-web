# Tracking — White-Label API-Only Provisioning (frontend lanes)

- **Feature**: White-Label API-Only Provisioning
- **Plan**: `vinta-schedule/ai-plans/2026-06-16-WHITELABEL_API_PROVISIONING_IMPLEMENTATION_PLAN.md` (cross-repo; backend phases live in `vinta-schedule`)
- **Scope of this run (frontend repo)**: Phase 10b, Phase 11b
- **Started**: 2026-06-18
- **Last updated**: 2026-06-18
- **Run options**: pause_between_phases = false (auto-flow); generate_inline_comments = true
- **Feature flag**: none (frontend safety = null/default branding renders today's vinta pages byte-for-byte)
- **Branch pattern**: `plan/whitelabel-api-provisioning/phase-{id}` (both branched from `main`, independent lanes)

## Completed Phases

### Phase 10b — Frontend: themed OAuth interstitials ✅
- **Status**: SUCCESS (implemented + reviewed + fixed + merged-ready)
- **Model**: claude-sonnet-4-6 (plan tier 3)
- **Branch**: `plan/whitelabel-api-provisioning/phase-10b` (base `main`)
- **PR**: https://github.com/vintasoftware/vinta-schedule-frontend-web/pull/55 (7 inline comments)
- **Depends on**: backend Phase 7 (`brandingForTenant` public GraphQL query)
- **Summary**:
  - New `branding-shared.ts` (client-safe: `TenantBranding`, `VINTA_DEFAULT_BRANDING`, pure `validateReturnUrl` with origin-equality + http(s) scheme guard) + `branding-server.ts` (`import 'server-only'` fetch, vinta-default on every failure path) + `branding.ts` compat barrel.
  - `auth-navbar.tsx` `ThemedBrandMark` swaps logo/app-name when branded, else delegates to original `BrandMark` (byte-identical vinta render). Vinta-default detected only when BOTH logo AND appName are sentinel.
  - success / error / finish-signup pages resolve branding from `tenant_id` searchParam (server components). finish-signup split into server shell + `FinishSignupForm` client component.
  - callback route threads `tenant_id`; `next` return-URL validated server-side (fail-closed); absolute URLs no longer prefixed with request origin.
  - Tests: `branding.test.ts`, `auth-navbar.test.tsx`, `finish-signup/page.test.tsx`; stories for auth-navbar / finish-signup-form / social-success. Full suite: 96 files / 899 tests green. typecheck + build (35/35 static pages) green.
- **Review findings resolved**: BLOCKER redirect-concat (absolute URL guard), BLOCKER missing component test (added), server-only module split, javascript:/data: scheme guard, appName-drop fix, dark-mode/next/image decisions documented, branded finish-signup test, colocated stories.
- **Known deviation (cross-repo follow-up)**: the OAuth callback has no frontend-reachable allowlist source (public `brandingForTenant` never exposes `returnUrlAllowlist` per plan §4.6; Phase 10a REST is reseller-admin-gated). `fetchReturnUrlAllowlist` therefore always returns `[]` and every `next` redirect fails closed to the default success page. Validation logic is correct and activates once a backend exposes a callback-reachable allowlist. **Backend follow-up needed.**
- **Note on `next/image`**: kept raw `<img>` for reseller logos (fully-dynamic external domains, can't be pre-listed in remotePatterns).

## Current Phase
- Phase 11b — Frontend: reseller branding console (in progress)

## Remaining Phases
- Phase 11b — Frontend: reseller branding console (depends on backend Phase 10a REST `/branding/`, already present in `schema.yml`; client regen required)

## Deferred Phases
- All backend phases (0–10a) — other repo (`vinta-schedule`), not executed by this run.
