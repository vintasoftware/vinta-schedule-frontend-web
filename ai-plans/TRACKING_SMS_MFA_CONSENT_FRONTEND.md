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

## Known interim condition
`npm run typecheck`/`build` fail on ONE file, `src/app/auth/signup/page.tsx`, because the base branch regenerated the client (accepted_terms/accepted_sms_consent now required on Signup) but the signup form isn't updated until **Phase 4**. Anticipated by the plan's Risk & Rollout Notes. Full `npm run test` is green throughout. Green typecheck/build restored at Phase 4.

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

## Current phase
Phase 3 — Terms of Use page (/terms)

## Remaining phases
- Phase 3 — Terms of Use page (/terms)
- Phase 4 — Email/password signup consent checkboxes (restores green typecheck/build)
- Phase 5 — Social finish-signup consent checkboxes
- Phase 6 — Consent hook + consent_required detector
- Phase 7 — Change-phone consent recording
- Phase 8 — consent_required gate handling on verification

## Deferred phases
- None (no cross-repo, no flag-removal — feature has no flag).
