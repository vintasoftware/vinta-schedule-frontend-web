# Organization Auth-Area Branding (Frontend) — Implementation Plan

Source contract: [2026-08-04-organization-auth-branding.md](../.vinta-ai-workflows/client-handoffs/2026-08-04-organization-auth-branding.md) (backend handoff, treated as the spec — no separate `*_SPEC.md`). Backend Phases 1–8 are merged on the API; this plan is the SPA adoption of that contract.

## 1. Goals

1. Regenerate the REST (`schema.yml` → `@/client`) and allauth (`schema-auth.yml` → `@/auth-client`) OpenAPI clients so typed surfaces include `redirect_url`, writable `slug`, `can_manage_branding`, and (where present) OAuth callback `destination`.
2. Let eligible org admins configure auth-area branding end-to-end in the existing `/branding` console: single `redirect_url`, public `slug` on the same page, logo **upload** (not a free-text URL), and three distinguishable write-403 UIs.
3. Gate the Branding nav entry (and treat deep links as absent) on `can_manage_branding` instead of `can_invite_organizations`.
4. After a successful social login callback, navigate using the server-resolved `destination` and delete all `validateReturnUrl` / client-driven `next`-allowlist logic.
5. Ship a branded login route at `/auth/login/[slug]/` that renders identity from `brandingForTenant(slug: …)` while leaving generic `/auth/login` on default vinta branding.

**Non-goals:**

- **Partner / public GraphQL write path** — `updateBranding`, `createBrandingLogoUpload`. SPA uses REST + signing upload (generated endpoint if present after regen, else `s3direct` `dest: "branding_logos"`).
- **Invitation-email Reply-To / `support_email` outbound behavior** — backend-only.
- **Billing upgrade purchase UI** — “not entitled” copy may say upgrade is required; no new billing flow or deep checkout.
- **Any replacement for `validateReturnUrl`** — delete call sites only; the backend owns post-auth destination.
- **Changing generic `/auth/login`** — remains default vinta identity.
- **Feature-flag infrastructure** — none exists in this repo; Guiding Decisions justify shipping ungated.
- **E2E for branding settings CRUD** — unit/integration only; Playwright is limited to OAuth `destination` + branded login (Step 0).

## 2. Guiding Decisions

| Decision                                   | Resolution                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Handoff is the spec**                    | No separate `*_SPEC.md`. Requirements, field rules, and SPA migration notes come from the 2026-08-04 client handoff.                                                                                                                                                                                                                                                                                 |
| **No feature flag**                        | Backend already live with no flag; SPA changes are contract adoption (breaking field rename with zero production callers of the old allowlist path) plus additive UX for newly eligible orgs. No flag module exists in this frontend. Documented skip of the mandatory flag-removal phase.                                                                                                           |
| **One use-case per phase**                 | Confirmed in Step 0. Cross-cutting schema regen is Phase 0 scaffolding.                                                                                                                                                                                                                                                                                                                              |
| **Phase order prioritizes must-ship auth** | After codegen, OAuth `destination` lands before settings polish so the branding-aware post-login landing is not blocked on form work.                                                                                                                                                                                                                                                                |
| **Slug UI on the branding page**           | One screen: slug + branding fields. On save, `PATCH /organizations/{id}/` for slug when needed, then `PUT /branding/`. Surface org `slug` 400s on the slug field.                                                                                                                                                                                                                                    |
| **Branded login path**                     | `/auth/login/[slug]/` under the existing auth tree; `/auth/login` unchanged.                                                                                                                                                                                                                                                                                                                         |
| **Nav gate = `can_manage_branding`**       | Top-level membership boolean from `GET /organizations/current` (and `mine`). Do **not** use it to predict write success (slug may still be missing). Drop the “Reseller” nav-group label — eligible orgs are no longer reseller-only.                                                                                                                                                                |
| **Deep link when ineligible**              | Branding must be **absent**, not a soft refuse: if `can_manage_branding` is false, redirect away from `/branding` (e.g. dashboard/home). Do not keep the old “reseller only” alert as the primary UX.                                                                                                                                                                                                |
| **Logo = upload widget**                   | Mirror `@src/hooks/users/use-upload-profile-picture.ts`: file picker, reject SVG + non-allowlisted types + size > 5 MB client-side, sign, S3 PUT, submit object key as `logo_url`. Prefer a generated branding upload-params operation if the synced schema exposes one; otherwise `POST /s3direct/get_upload_params/` with `dest: "branding_logos"`. Read `logo_url` only as an opaque display URL. |
| **`redirect_url` client validation**       | Zod mirrors the five server rules (no control chars, HTTPS only, no `*`, no non-root path ending in `/`, well-formed host) for immediate UX; server remains authoritative. Empty string clears.                                                                                                                                                                                                      |
| **403 matching**                           | Prefer substring match on REST `detail` (`"has a parent"`, `"white-label branding"`, `"public slug"`) per handoff — not exact string equality.                                                                                                                                                                                                                                                       |
| **E2E scope**                              | Playwright only for (1) branded `/auth/login/[slug]/` and (2) post-auth navigation honoring `destination`. Settings flows stay Vitest + Testing Library.                                                                                                                                                                                                                                             |
| **Deploy ordering**                        | Backend already first. SPA adopts at its own pace; incomplete until Phase 1 (`destination`) ships.                                                                                                                                                                                                                                                                                                   |

## 3. Data Model Changes

No frontend persistence. Types come from regenerated clients + small SPA-only helpers.

### 3.1 Regenerated REST types (`@/client`) — expected after Phase 0

- `OrganizationBranding` / writable branding body: `return_url_allowlist` **removed**; `redirect_url?: string` **added**.
- `CurrentMembership` / `MyMembership`: additive `can_manage_branding: boolean`.
- `Organization` / update body: `slug` writable (nullable; blank/`null` clears to `NULL`).
- `OrganizationBrief`: `slug` readable (already present as read-only in places today — confirm writable org update + brief after regen).

### 3.2 Auth callback `destination`

- Prefer typing from regenerated `@/auth-client` if `schema-auth.yml` exposes it on the authenticated provider-callback response.
- If allauth OpenAPI still omits it (handoff field is on a custom headless callback), extend the hand-maintained callback typing in `@src/addicional-auth-client/provider-login-callback-json.ts` (and/or a narrow SPA type used by `@src/app/auth/social/[provider]/callback/route.tsx`) with optional `destination?: string` on the successful JSON body. Do not invent a GraphQL replacement.

### 3.3 SPA-only helpers

- `parseBrandingWriteForbidden(detail: string): 'has_parent' | 'not_entitled' | 'no_slug' | 'unknown'` — substring classifier for write 403s.
- Optional shared slug / redirect_url zod fragments colocated with the branding form (or `@src/lib/branding-validation.ts`) so unit tests can cover rules without mounting the full form.

## 4. API Design

No new backend API. Frontend consumption of the handoff contract:

### 4.1 Branding REST — `GET/PUT/PATCH /branding/`

- Auth: session + org admin + `X-Organization-Id` (existing interceptor).
- Read gate: parentless + `white_label_branding` (slug not required). Write gate: read gate + slug set.
- Body/response field rename: `redirect_url` (single HTTPS URL or `""`).
- Errors: `400` field errors; `403` three distinguishable `detail` strings; `404` no row yet.

### 4.2 Organization update — `PATCH /organizations/{id}/`

- Writable `slug` (validation + uniqueness per handoff). Used from the branding page save path.
- Precedent hooks: `@src/hooks/sync/use-rooms-sync-config.ts` / `use-external-event-update-policy.ts` already wrap `organizationsPartialUpdateMutation`.

### 4.3 Capability signal — `can_manage_branding`

- `GET /organizations/current/` and `GET /organizations/mine/` — boolean, always present. Drives nav + page presence only.

### 4.4 Logo signing

- Preferred: generated REST upload-params operation if present after schema sync (same shape as profile-picture params).
- Fallback: `POST /s3direct/get_upload_params/` with `dest: "branding_logos"`. Content types: `image/png`, `image/jpeg`, `image/webp` only; max 5 MB.

### 4.5 Public GraphQL — `brandingForTenant`

- Add optional `slug` argument alongside existing `tenantId` in `@src/lib/branding-server.ts`. Unknown slug → default branding (indistinguishable). Used by `/auth/login/[slug]/`.

### 4.6 OAuth provider callback (headless)

- Successful authenticated JSON includes `destination` (absolute URL or platform dashboard fallback). SPA must navigate there and must **not** decide landing from client `next` / `validateReturnUrl`.
- Continue sending whatever `callback_url` / OAuth plumbing the flow already requires.

### 4.7 Removed

- GraphQL `validateReturnUrl` — delete `@src/lib/branding-server.ts` query + `fetchValidatedReturnUrl` + tests + callback call sites.

## 5. Phased Rollout

Ordering: codegen → must-ship OAuth destination → branding form contract + eligibility UX → logo upload → branded login. No feature flag ⇒ no flag-removal phase.

---

### Phase 0 — Sync schemas and regenerate clients

**Goal**: Ship value: none on its own — foundation. Committed `schema.yml` / `schema-auth.yml` and generated clients match the live backend contract described in the handoff.

**Feature flag**: none — scaffolding; no reachable behavior change until later phases consume the new types. (Call sites still compile against old field names until Phase 2+; Phase 0 may leave a temporary typecheck break if generated types drop `return_url_allowlist` before Phase 2 lands — **prefer landing Phase 0 + Phase 2 in quick succession**, or keep Phase 0 scoped to schema files + regen and immediately follow with Phase 2 on the same branch if stacked PRs would be red. If stacking, Phase 0 PR must either (a) include mechanical renames enough to typecheck, or (b) be marked not-merge-alone — prefer (a): minimal compile fixes that map old form field to `redirect_url` stub only if needed. **Resolution: Phase 0 includes the minimal mechanical renames required for `pnpm run typecheck` green** — treat full form UX as Phase 2.)

Changes:

1. Replace `@schema.yml` with the backend-exported OpenAPI from the organization-auth-branding stack (operator provides/copies the file).
2. Replace `@schema-auth.yml` similarly when the auth schema includes callback/`destination` (or document in the PR if allauth schema is unchanged and typing will be hand-extended in Phase 1).
3. Run `pnpm run openapi-ts` and `pnpm run openapi-ts-auth`. Never hand-edit `@src/client/` or `@src/auth-client/` afterward.
4. Minimal compile fixes only: any reference that breaks solely because `return_url_allowlist` disappeared / `redirect_url` appeared — enough for typecheck. Full form UX stays Phase 2.

Spec use-case: shared scaffolding — no use-case yet.

Tests:

- **Unit**: none beyond ensuring existing suites still typecheck/run after regen + minimal renames.
- **Integration**: `pnpm run typecheck` green.

**Suggested AI model**: Tier 1 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). Schema copy + codegen + mechanical renames.

**Reusable skills**: none — codegen + mechanical type fixes.

Acceptance: regenerated clients expose `redirect_url` (not `return_url_allowlist`) on branding types and `can_manage_branding` on membership types; `pnpm run typecheck` passes.

---

### Phase 1 — Honor OAuth `destination`; delete `validateReturnUrl`

**Goal**: After a successful social provider callback, the SPA navigates to the server-provided `destination` and no longer validates or trusts client `next` via GraphQL `validateReturnUrl`.

**Feature flag**: none — see Guiding Decisions.

Changes:

1. `@src/app/auth/social/[provider]/callback/route.tsx` — on `isAuthenticatedResponse`, read `destination` from the callback JSON; use it as the redirect URL when present and non-empty. Remove `fetchValidatedReturnUrl(tenantId, nextParam)` and the allowlist-based branch. Keep pending-flow routing (`provider_signup`, MFA, verify\_\*) unchanged. Absolute `destination` URLs must not be origin-prefixed (existing absolute-URL guard stays).
2. `@src/addicional-auth-client/provider-login-callback-json.ts` (and auth-client types if regenerated) — ensure successful response typing includes optional `destination`.
3. `@src/lib/branding-server.ts` — delete `VALIDATE_RETURN_URL_QUERY` and `fetchValidatedReturnUrl`.
4. `@src/lib/branding.ts` — stop re-exporting `fetchValidatedReturnUrl`.
5. `@src/lib/branding-shared.ts` — update comments that reference `validateReturnUrl`.
6. Update `@src/app/auth/social/[provider]/callback/route.test.ts` and `@src/lib/branding.test.ts` accordingly.

Spec use-case: handoff “Resolved post-auth destination” / SPA must-ship behavior change.

Tests:

- **Unit**: `@src/app/auth/social/[provider]/callback/route.test.ts` — authenticated response with `destination` → redirect to that URL; missing `destination` → existing success-interstitial fallback (or dashboard path consistent with current non-allowlist behavior); pending flows unchanged; prove `fetchValidatedReturnUrl` is not called.
- **Unit**: `@src/lib/branding.test.ts` — remove `fetchValidatedReturnUrl` cases; keep `fetchBrandingForTenant` coverage.
- **E2E**: `@e2e/tests/app/PR044-oauth-destination.spec.ts` — happy path: complete (or resume) social login against a QA org with a configured branding `redirect_url` and assert the browser lands on that destination (screenshots via `testInfo.outputPath`). Follow [add-e2e-test](../.claude/skills/add-e2e-test/SKILL.md); append `PR044` to [QA_USE_CASES.md](../QA_USE_CASES.md). **Prerequisite**: live backend + QA credentials capable of finishing the provider callback; if the harness cannot drive full OAuth, document the blocker in the PR and keep unit coverage as the merge gate while the e2e stays marked pending/skipped with reason — do not silently drop the use-case id.

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). Auth/session callback is cross-cutting and easy to regress.

**Review models**: reviewer Tier 4 — open-redirect / post-auth navigation blast radius; fixer on project default.

**Reusable skills**: `add-e2e-test` (for PR044); `systematic-debugging` only if callback regressions appear.

Acceptance: successful callback with `destination` redirects there; `grep -r "validateReturnUrl" src/` returns nothing; unit tests green; e2e PR044 present (passing or explicitly blocked with documented harness gap).

---

### Phase 2 — Branding form: `redirect_url` replaces allowlist

**Goal**: Admins configure a single post-login HTTPS `redirect_url` (or clear it) instead of a return-URL allowlist array.

**Feature flag**: none.

Changes:

1. `@src/components/branding/branding-form.tsx` — replace `return_url_allowlist` field array with one `redirect_url` input; update zod (`brandingSchema`) to the five handoff rules + empty-clear; update `toFormValues` / `toPayload`.
2. `@src/components/branding/branding-form.test.tsx` — rewrite allowlist cases to `redirect_url` validation + payload assertions.
3. `@src/components/branding/branding-form.stories.tsx` — fixture uses `redirect_url`.
4. Copy/labels: “Post-login redirect URL” (or equivalent), help text that it must be a concrete HTTPS URL (no wildcards).
5. Page description strings that still say “reseller” → eligible-organization / white-label wording where touched.

Spec use-case: handoff REST branding field rename / SPA migration for `redirect_url`.

Tests:

- **Unit**: `@src/components/branding/branding-form.test.tsx` — rejects `http://`, `*`, path-prefix `/…/`, control characters; accepts empty and valid HTTPS; PUT body sends `redirect_url` string (not an array).

**Suggested AI model**: Tier 2 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). Established form + zod pattern.

**Reusable skills**: `add-storybook-story` (update colocated story).

Acceptance: saving branding sends `redirect_url`; no remaining `return_url_allowlist` references under `src/components/branding/` or branding hooks.

---

### Phase 3 — Gate Branding on `can_manage_branding`

**Goal**: Branding entry point is absent for orgs that can never manage branding; eligible orgs (including slug-less) still see the page.

**Feature flag**: none.

Changes:

1. `@src/components/navigation/app-layout-client.tsx` — replace `can_invite_organizations` check for the Branding link with `membership.can_manage_branding === true`. Rename/remove the “Reseller” group label (e.g. attach Branding under Admin when admin, or a neutral group).
2. `@src/app/(app)/branding/page.tsx` — if current membership has `can_manage_branding !== true`, redirect away (absent). Update loading/forbidden copy away from “reseller only”; GET 403 remains a rare backstop (optional substring split for has-parent vs not-entitled).
3. `@src/app/(app)/layout.test.tsx` (and any nav tests) — assert link visibility on `can_manage_branding`, not `can_invite_organizations`.
4. Invalidate/rely on existing `CURRENT_ORGANIZATION_QUERY_KEY` — no new query.

Spec use-case: handoff `can_manage_branding` client migration (“page must be absent, not merely refused”).

Tests:

- **Unit**: `@src/app/(app)/layout.test.tsx` — link shown when `can_manage_branding: true` (even if `can_invite_organizations: false`); hidden when `can_manage_branding: false`.
- **Unit**: branding page test (new or extended) — ineligible membership redirects / does not render the form shell.

**Suggested AI model**: Tier 2 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)).

**Reusable skills**: none.

Acceptance: non-eligible orgs never see a Branding nav item; direct `/branding` does not show a soft “reseller” refuse for them.

---

### Phase 4 — Slug field on the branding page

**Goal**: Eligible admins pick or change the org public `slug` on the branding console before (or as part of) saving branding.

**Feature flag**: none.

Changes:

1. New `@src/hooks/organizations/use-update-organization-slug.ts` (or generalize a thin `use-partial-update-organization.ts`) wrapping `organizationsPartialUpdateMutation`, invalidating `CURRENT_ORGANIZATION_QUERY_KEY` (+ my-orgs key if slug appears in switcher).
2. `@src/components/branding/branding-form.tsx` — add `slug` field; client zod for confusables/format/length/reserved-word subset (or format-only + server for reserved list — prefer format + uniqueness from server, reserved list mirrored if cheap).
3. Submit sequencing: if slug dirty (or branding save requires a slug and local value is set), `PATCH` org first; map `400` `{ slug: […] }` to the slug field; then `PUT` branding.
4. Show current slug from `useCurrentOrganization()` / membership.organization.slug; warn that changing slug orphans old branded login URLs.
5. Stories + tests updated.

Spec use-case: handoff “slug settings screen” + SPA note that writes need a slug.

Tests:

- **Unit**: hook test — PATCH body `{ slug }`, invalidates current-org query.
- **Unit**: form tests — slug field errors from 400; successful save calls org PATCH then branding PUT when slug changed; unchanged slug skips PATCH.

**Suggested AI model**: Tier 2 for the hook; Tier 3 if form submit orchestration + cache invalidation gets large. IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml).

**Reusable skills**: `new-hook`; `add-storybook-story`.

Acceptance: an eligible slug-less org can set a slug from `/branding` and then persist branding in the same session flow.

---

### Phase 5 — Distinguishable branding write 403 UIs

**Goal**: Write failures for has-parent / not-entitled / no-slug render three distinct UX states (not one generic forbidden toast).

**Feature flag**: none.

Changes:

1. New helper `@src/lib/branding-write-errors.ts` — `parseBrandingWriteForbidden` via substrings from the handoff table.
2. `@src/components/branding/branding-form.tsx` (and/or page) — on mutation error, branch:
   - **has_parent** — permanent “not available for this organization” (and consider redirect/hide if `can_manage_branding` should already have blocked — still handle stale cache).
   - **not_entitled** — message that the plan lacks white-label branding (copy only; no billing UI).
   - **no_slug** — inline prompt focused on the slug field (“pick a public slug first”).
3. Tests for the parser + form error rendering.

Spec use-case: handoff “Three distinguishable 403 reasons”.

Tests:

- **Unit**: `@src/lib/branding-write-errors.test.ts` — each `detail` string maps correctly; unknown → `unknown`.
- **Unit**: form/page tests — each reason renders distinct UI.

**Suggested AI model**: Tier 2 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)).

**Reusable skills**: none.

Acceptance: forcing each of the three 403 bodies in tests yields three different user-visible states.

---

### Phase 6 — Logo upload widget

**Goal**: Admins upload a PNG/JPEG/WebP logo (≤5 MB, no SVG) via signed upload; saved branding stores the object key; UI displays the delivery-route `logo_url` as an opaque image URL.

**Feature flag**: none.

Changes:

1. New `@src/hooks/branding/use-upload-branding-logo.ts` — mirror profile-picture upload hook; wire to generated branding upload-params if present post-regen, else s3direct `dest: "branding_logos"`.
2. `@src/components/branding/branding-form.tsx` — replace free-text logo URL input with file picker + preview + clear; client-side type/size checks; submit key (or empty string to clear) as `logo_url`.
3. Do not parse delivery URLs as S3 keys.
4. Stories + tests (validation errors, successful key in PUT body).

Spec use-case: handoff “Logo upload flow” SPA migration.

Tests:

- **Unit**: upload hook — rejects SVG / oversized before sign; happy path returns key/URL for the form.
- **Unit**: form — choosing a file ends up as `logo_url` object key in the branding PUT body; clear sends `""` / omits per existing clear semantics.

**Suggested AI model**: Tier 2 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). Exact precedent in profile-picture upload.

**Reusable skills**: `new-hook`; `add-storybook-story`.

Acceptance: branding save after upload sends a `branding_logos` key (or schema-equivalent), not a pasted third-party URL; SVG cannot be selected successfully.

---

### Phase 7 — Branded `/auth/login/[slug]/` route

**Goal**: Visiting `/auth/login/{slug}/` renders login with that org’s public branding (or vinta default for unknown slugs); generic `/auth/login` unchanged.

**Feature flag**: none.

Changes:

1. `@src/lib/branding-server.ts` — extend `fetchBrandingForTenant` (or add `fetchBrandingForSlug`) to query `brandingForTenant(slug: $slug) { … }` when a slug is provided; keep tenantId path for existing interstitial callers.
2. New `@src/app/auth/login/[slug]/page.tsx` — server component: parse slug, fetch branding, load auth config (same as login page), render `LoginForm` / `AuthLayout` with branded navbar (same composition as current login).
3. Ensure OAuth start from this page still sends required callback plumbing; do **not** treat slug as org-scoping for post-auth membership (handoff: slug is display-only pre-auth).
4. Unit tests for slug GraphQL query helper; page test for default fallback on unknown slug.
5. Storybook only if a new visual composition is extracted; otherwise reuse AuthNavbar stories.

Spec use-case: handoff “Slug-scoped branded login”.

Tests:

- **Unit**: branding-server tests — slug query used; failure/null → `VINTA_DEFAULT_BRANDING`.
- **Unit**: login `[slug]` page test — unknown slug still renders login with default branding (no error page).
- **E2E**: `@e2e/tests/app/PR045-branded-login.spec.ts` — open `/auth/login/<known-qa-slug>/`, assert branded app name/logo (or distinct from default), screenshot steps; unknown slug still shows login (default identity). Follow [add-e2e-test](../.claude/skills/add-e2e-test/SKILL.md); append `PR045` to [QA_USE_CASES.md](../QA_USE_CASES.md). Requires a QA org with a known public slug + branding.

**Suggested AI model**: Tier 3 (IDs in [resources/ai-models.yaml](.claude/skills/plan-feature/resources/ai-models.yaml)). New App Router route + server branding fetch + auth composition.

**Reusable skills**: `new-page`; `add-e2e-test`.

Acceptance: `/auth/login/<slug>/` shows tenant branding for a real slug and default branding for a fake slug; `/auth/login` behavior unchanged; PR045 e2e present.

## 6. Risk & Rollout Notes

- **No feature flag** — rollback is revert of the phase PR(s). Highest-risk revert target is Phase 1 (callback navigation).
- **Schema sync dependency** — Phase 0 blocked on operator-provided `schema.yml` / `schema-auth.yml` from the backend stack. Stale schema leaves the SPA on `return_url_allowlist` types that the live API no longer accepts.
- **`destination` typing gap** — if `schema-auth.yml` lacks the field, hand-extend the additional auth client; confirm against a real callback payload on staging before merging Phase 1.
- **Logo signing path** — confirm whether regen adds a first-class branding upload-params route; s3direct fallback must match backend `dest: "branding_logos"` auth (parentless + entitled).
- **E2E OAuth fragility** — PR044 may be blocked by lack of automated social-login in the Playwright harness; keep unit tests authoritative and document skip reason rather than inventing mocks (suite policy: live backend, no mock layer).
- **Slug mutability** — changing slug orphans old branded URLs (falls back to default identity); warn in UI (Phase 4).
- **Cache staleness** — `can_manage_branding` true with write 403 no-slug is expected; Phase 5 UX covers it. After setting slug, invalidate current-org + branding queries.
- **Backfill** — none on the SPA.
- **Rollback** — revert PR; no DB migration in this repo.

## 7. Open Questions

| Item                                                                        | Recommended default                                                                                                                                       |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exact redirect when `can_manage_branding` is false on `/branding` deep link | Redirect to `/` (or existing app home) with no toast.                                                                                                     |
| Reserved-word list mirroring on the client                                  | Format/length client-side; reserved + uniqueness from server 400 — avoids drifting copies of `slug_validation.py`.                                        |
| PR044 OAuth e2e if social login cannot be automated                         | Keep id + spec file with `test.skip` + reason; unit tests remain merge gate. Owner: implementer of Phase 1 to confirm harness feasibility with QA tokens. |
| Branding upload-params REST vs s3direct                                     | Prefer generated REST if present after Phase 0; else s3direct. Decide in Phase 6 from the regenerated schema, not before.                                 |

## 8. Touch List

### Phase 0

- [schema.yml](../schema.yml) (replace)
- [schema-auth.yml](../schema-auth.yml) (replace as needed)
- Generated: `@src/client/**`, `@src/auth-client/**` (via `pnpm run openapi-ts` / `openapi-ts-auth` only)
- Minimal compile fixes in branding form/types consumers if required for typecheck

### Phase 1

- [src/app/auth/social/[provider]/callback/route.tsx](../src/app/auth/social/[provider]/callback/route.tsx)
- [src/app/auth/social/[provider]/callback/route.test.ts](../src/app/auth/social/[provider]/callback/route.test.ts)
- [src/lib/branding-server.ts](../src/lib/branding-server.ts)
- [src/lib/branding.ts](../src/lib/branding.ts)
- [src/lib/branding-shared.ts](../src/lib/branding-shared.ts)
- [src/lib/branding.test.ts](../src/lib/branding.test.ts)
- [src/addicional-auth-client/provider-login-callback-json.ts](../src/addicional-auth-client/provider-login-callback-json.ts)
- New: `@e2e/tests/app/PR044-oauth-destination.spec.ts`, page object as needed, [QA_USE_CASES.md](../QA_USE_CASES.md)

### Phase 2

- [src/components/branding/branding-form.tsx](../src/components/branding/branding-form.tsx)
- [src/components/branding/branding-form.test.tsx](../src/components/branding/branding-form.test.tsx)
- [src/components/branding/branding-form.stories.tsx](../src/components/branding/branding-form.stories.tsx)
- [src/app/(app)/branding/page.tsx](<../src/app/(app)/branding/page.tsx>) (copy only if touched)

### Phase 3

- [src/components/navigation/app-layout-client.tsx](../src/components/navigation/app-layout-client.tsx)
- [src/app/(app)/branding/page.tsx](<../src/app/(app)/branding/page.tsx>)
- [src/app/(app)/layout.test.tsx](<../src/app/(app)/layout.test.tsx>)

### Phase 4

- New: `@src/hooks/organizations/use-update-organization-slug.ts` (+ test)
- [src/components/branding/branding-form.tsx](../src/components/branding/branding-form.tsx) (+ test/stories)
- [src/hooks/organizations/use-current-organization.ts](../src/hooks/organizations/use-current-organization.ts) (invalidation consumers only)

### Phase 5

- New: `@src/lib/branding-write-errors.ts` (+ test)
- [src/components/branding/branding-form.tsx](../src/components/branding/branding-form.tsx) (+ test)

### Phase 6

- New: `@src/hooks/branding/use-upload-branding-logo.ts` (+ test)
- [src/components/branding/branding-form.tsx](../src/components/branding/branding-form.tsx) (+ test/stories)
- Possibly thin s3direct helper under `@src/lib/` if no generated operation exists

### Phase 7

- [src/lib/branding-server.ts](../src/lib/branding-server.ts) (+ [src/lib/branding.test.ts](../src/lib/branding.test.ts))
- New: `@src/app/auth/login/[slug]/page.tsx` (+ test)
- New: `@e2e/tests/app/PR045-branded-login.spec.ts`, page object, [QA_USE_CASES.md](../QA_USE_CASES.md)
