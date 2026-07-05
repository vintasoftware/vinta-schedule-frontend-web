# Tracking — SMS MFA Consent (Frontend)

- **Plan**: [ai-plans/2026-07-04-SMS_MFA_CONSENT_FRONTEND_IMPLEMENTATION_PLAN.md](2026-07-04-SMS_MFA_CONSENT_FRONTEND_IMPLEMENTATION_PLAN.md)
- **Started**: 2026-07-04
- **Last updated**: 2026-07-04
- **Feature flag**: none (contract fix — see plan Guiding Decisions)

## Run options
- `pause_between_phases`: false (auto-flow)
- `generate_inline_comments`: true
- Base: dedicated base branch + PR
- E2E: skip Playwright specs per user; only update QA_USE_CASES.md for UI-flow phases

## Branch stack
- `main`
- └ `plan/sms-mfa-consent-frontend/base` — PR #57 (regenerated client + plan docs)
-   └ `plan/sms-mfa-consent-frontend/phase-1` — PR #58
-     └ `plan/sms-mfa-consent-frontend/phase-2` — PR #59
-       └ `plan/sms-mfa-consent-frontend/phase-3` — PR #60
-         └ `plan/sms-mfa-consent-frontend/phase-4` — PR #61 (restores green typecheck/build)
-           └ `plan/sms-mfa-consent-frontend/phase-5` — PR #62
-             └ `plan/sms-mfa-consent-frontend/phase-6` — PR #63

## Known interim condition — RESOLVED at Phase 4
`npm run typecheck`/`build` failed on ONE file, `src/app/auth/signup/page.tsx` (base regenerated the client → accepted_terms/accepted_sms_consent required on Signup, form didn't send them), on the base + phases 1–3 branches. **Phase 4 restores green typecheck/build.** Full `npm run test` was green throughout.

## Completed Phases

### Phase 1 — Policy fetch + markdown render scaffolding ✅
- **Status**: done. Model: sonnet (Tier 3 suggested). Branch `plan/sms-mfa-consent-frontend/phase-1` (base: `.../base`). PR #58.
- **Files**: `src/lib/policy-documents-server.ts` (+test), `src/lib/render-markdown.ts` (+test), `src/components/policy/policy-document-view.tsx` (+test), `package.json`/lock (remark-parse, remark-gfm, remark-rehype, rehype-sanitize, rehype-stringify, unified).
- **Summary**: `server-only` fail-safe policy fetch (mirrors branding-server.ts, returns null on any failure); `server-only` markdown→sanitized-HTML pipeline (remarkParse→remarkGfm→remarkRehype→rehypeSanitize→rehypeStringify), safe for dangerouslySetInnerHTML; async Server Component PolicyDocumentView with placeholder empty-state. Reviewer confirmed sanitization safe against live payloads; fixes applied: dropped dead `remark` dep, added `remark-gfm` for tables/strikethrough, strengthened sanitizer test. 987 tests green.
- **Deferred (from review, as follow-ups)**: no Storybook story (async-RSC limitation in nextjs-vite runner); possible double-`<h1>` if backend body_markdown repeats the title — verify against real content in Phase 2.

### Phase 2 — Privacy Policy page (/privacy) ✅
- **Status**: done. Model: sonnet (Tier 2 suggested). Branch `.../phase-2` (base: `.../phase-1`). PR #59.
- **Files**: `src/app/privacy/page.tsx` (+test), `QA_USE_CASES.md` (added PR039).
- **Summary**: public async server route, no auth wrapper, `metadata.title`, Section+Container(prose), consumes `fetchLatestPolicyDocument('privacy_policy')` + `PolicyDocumentView`. Fix from review: idiomatic direct `<PolicyDocumentView .../>` JSX (was await-and-embed); page test mocks the child and asserts wiring only. 989 tests green.
- **Follow-up (confirmed, backend content)**: duplicate title/two-h1 if backend `body_markdown` leads with the title — plan/handoff both specify rendering title separately; raise with backend content authors.

### Phase 3 — Terms of Use page (/terms) ✅
- **Status**: done. Model: haiku (Tier 1 suggested). Branch `.../phase-3` (base: `.../phase-2`). PR #60.
- **Files**: `src/app/terms/page.tsx` (+test), `QA_USE_CASES.md` (added PR040).
- **Summary**: line-for-line mirror of Phase 2 for `terms_of_use` + "Terms of Use" title; direct-JSX PolicyDocumentView; test mocks child+fetch, asserts wiring. Verified as faithful mirror of reviewed Phase 2 (Layer 3 satisfied by diff comparison). 991 tests green.

### Phase 4 — Email/password signup consent checkboxes ✅
- **Status**: done. Model: sonnet (Tier 2 suggested). Branch `.../phase-4` (base: `.../phase-3`). PR #61 (2/3 inline comments — 3rd failed: target line 150 not in diff).
- **Files**: `src/app/auth/signup/page.tsx`, `src/app/auth/signup/page.test.tsx` (new), `QA_USE_CASES.md` (PR041).
- **Summary**: two separate required unchecked checkboxes (accepted_terms w/ links to /privacy,/terms opening new tab; accepted_sms_consent w/ handoff copy), each z.boolean().refine(true); both flow into Signup POST body. **Restores green typecheck+build.** Review fixes: new-tab links, test hardening (confirm_password stripped, other checkbox error absent). 996 tests green.

### Phase 5 — Social finish-signup consent checkboxes ✅
- **Status**: done. Model: sonnet (Tier 2 suggested). Branch `.../phase-5` (base: `.../phase-4`). PR #62 (2/3 inline comments — 3rd target line unchanged).
- **Files**: `src/components/authentication/finish-signup-form.tsx`, `.../finish-signup-form.test.tsx` (new), `src/app/auth/social/finish-signup/page.test.tsx` (integration test updated), `QA_USE_CASES.md` (PR042).
- **Summary**: mirrors Phase 4 into the OAuth finish-signup form; consent reset to false in both defaultValues + provider-prefill reset; both booleans in ProviderSignup body; verify_phone handoff preserved. Reviewer: no BLOCKER/SHOULD-FIX. 1002 tests green.

### Phase 6 — Consent hook + consent_required detector ✅
- **Status**: done. Model: haiku (Tier 2 suggested). Branch `.../phase-6` (base: `.../phase-5`). PR #63.
- **Files**: `src/hooks/consents/use-create-consent.ts` (+test), `src/lib/consent-errors.ts` (+test).
- **Summary**: `useCreateConsent` wraps consentsCreateMutation (body-only); `isConsentRequiredError` matches top-level `errors[].code === 'consent_required'` (status-agnostic). Reviewer verified with evidence the clients throw the parsed JSON body at top level, so the detector fires on the real Phase 8 403. Fixes: accurate JSDoc, canonical §4.4 fixture test, less brittle assertions. 1025 tests green.
- **Phase 8 dependency confirmed**: verify-phone/resend 403 errors carry top-level `.errors`/`.status` (see phone-verify-dialog.tsx, use-verify-phone.ts).

## Current phase
Phase 7 — Change-phone consent recording

## Remaining phases
- Phase 6 — Consent hook + consent_required detector
- Phase 7 — Change-phone consent recording
- Phase 8 — consent_required gate handling on verification

## Deferred phases
- None (no cross-repo, no flag-removal — feature has no flag).
