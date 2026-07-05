# SMS MFA Consent (Frontend) — Implementation Plan

Source spec: [2026-07-04-SMS_MFA_CONSENT_FRONTEND_HANDOFF.md](2026-07-04-SMS_MFA_CONSENT_FRONTEND_HANDOFF.md) (backend handoff, treated as the spec). Backend Phases 1–9 are merged; the generated SDKs in this repo are already regenerated against them (`BaseSignup` now requires `accepted_terms` + `accepted_sms_consent`; `ConsentCreate` has `document_type` + `phone_number`; `DocumentTypeEnum` includes `sms_consent`).

## 1. Goals

1. Publish public, server-rendered **Privacy Policy** (`/privacy`) and **Terms of Use** (`/terms`) pages that fetch the latest published policy document and render its markdown safely, with a graceful placeholder when nothing is published (`404`).
2. Collect the two now-required consent acknowledgements (`accepted_terms`, `accepted_sms_consent`) as **two distinct unchecked checkboxes** in the **email/password signup** form and the **social finish-signup** form, wired into their existing POST bodies.
3. Record **phone-keyed SMS consent** (`POST /consents/` with `phone_number`) when a signed-in user changes to a **new phone number**, before a verification code is requested for it.
4. Detect the backend's `403 consent_required` on phone-verification requests and route the user to record consent + retry, instead of surfacing a generic error.

**Non-goals:**

- **No schema/client regeneration.** The SDKs are already regenerated; this plan consumes them. Refreshing schema is out of scope (see [schema-source memory](../.claude/projects/-Users-hugobessa-Workspaces-vinta-schedule-frontend-web/memory/schema-source-vinta-schedule.md) if that ever changes).
- **No login-by-phone consent step.** Login-by-phone is not wired in this app (no phone field on the login page). Deferred to a follow-up if/when phone login ships.
- **No separate post-OAuth `POST /consents/` consent screen.** Social users are covered by the finish-signup checkboxes (`ProviderSignup` body). A standalone consent interstitial for already-authenticated social users who never hit finish-signup is a follow-up.
- **No feature flag / flag infrastructure.** No flag mechanism exists in the frontend, and the consent fields are already required by the backend (see Guiding Decisions).
- **No version-history / audit UI** for policy documents (the authenticated `/policy-documents/` history endpoints are not surfaced).
- **No admin authoring UI** for policy documents (backend/admin concern).

## 2. Guiding Decisions

| Decision                                                       | Resolution                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **No feature flag**                                            | The backend made `accepted_terms` + `accepted_sms_consent` **required** on signup (`BaseSignup`), so the current frontend signup POST would be rejected until it sends them. This is a mandatory contract fix, not an opt-in behavior change — gating it behind a flag would leave signup broken in the off state. No flag infra exists to reuse either. Ship unconditionally. |
| **Markdown rendered server-side to sanitized HTML**            | Policy pages are public and content-heavy; server rendering gives SEO + smaller client bundle. Add `remark` + `remark-rehype` + `rehype-sanitize` + `rehype-stringify` (no markdown renderer exists today). Sanitize on the server before injecting. Never inject raw `body_markdown` as HTML.                                                                                 |
| **Public fetch via `server-only` module**                      | Follow the existing precedent in [branding-server.ts](../src/lib/branding-server.ts): a `import 'server-only'` module that reads `NEXT_PUBLIC_API_BASE_URL`, hits the public endpoint directly (no auth), and returns a safe value on any failure. Policy fetch returns `null` on `404`/error so pages render a placeholder.                                                   |
| **Policy routes at top level**                                 | `/privacy` and `/terms` — public, linkable from signup and footers, resolvable before a session exists (needed during signup).                                                                                                                                                                                                                                                 |
| **OAuth consent = finish-signup checkboxes**                   | `ProviderSignup = BaseSignup`, so the social finish-signup form already must send both booleans. Adding the two checkboxes there mirrors the email path and keeps one consent-capture pattern.                                                                                                                                                                                 |
| **Consent checkboxes never pre-checked, always separate**      | Twilio/TCPA require SMS consent to be its own explicit opt-in. `accepted_terms` and `accepted_sms_consent` are two distinct `zod` `boolean` fields, each `.refine(v => v === true)`, each with its own inline error and its own copy. Do not merge into one control; do not default either to `true`.                                                                          |
| **Phone-keyed consent scope = change-phone only**              | The gate is phone-keyed. Only the change-phone flow submits a new phone in this app; login-by-phone isn't present. Record `sms_consent` (with the new `phone_number`) via `POST /consents/` before a code is requested for a changed phone.                                                                                                                                    |
| **`consent_required` handled via a shared detector**           | A single helper (`isConsentRequiredError`) inspects `errors[].code === 'consent_required'` so verify-phone, resend, and change-phone all route to the same consent-recovery path. The gate is live even though phone verification is disabled server-side, so this is defensive-but-correct.                                                                                   |
| **Hooks follow repo `src/hooks/<domain>/use-*.ts` convention** | New `policy-documents` and `consents` hook domains wrap the generated `*Options` / `*Mutation` from `@/client`, returning `{ data, ... }` / `{ action, actionMutation }` like existing hooks.                                                                                                                                                                                  |

## 3. Data Model Changes

No frontend persistence. This section documents the **types already present in the generated SDK** that the plan consumes — no new types are authored unless noted.

### 3.1 Consumed generated types (`@/client`)

- [`ConsentCreate`](../src/client/types.gen.ts#L536) — `{ document_type: DocumentTypeEnum; phone_number?: string }` (request body for `POST /consents/`).
- [`UserConsent`](../src/client/types.gen.ts) — `201` response.
- [`PolicyDocument`](../src/client/types.gen.ts#L1368) — response of the policy-document GET endpoints (`id`, `document_type`, `version`, `title`, `body_markdown`, `published_at`).
- [`DocumentTypeEnum`](../src/client/types.gen.ts#L568) — `'privacy_policy' | 'terms_of_use' | 'sms_consent'`.

### 3.2 Consumed generated types (`@/auth-client`)

- [`BaseSignup`](../src/auth-client/types.gen.ts#L136) — now includes required `accepted_terms: boolean` + `accepted_sms_consent: boolean`.
- [`Signup`](../src/auth-client/types.gen.ts#L526) (email path) and [`ProviderSignup`](../src/auth-client/types.gen.ts#L407) (`= BaseSignup`, social finish-signup path) both inherit those fields.

### 3.3 New frontend-only types / helpers

- `PolicyDocument | null` return of the server fetch helper (Phase 1).
- `isConsentRequiredError(error): boolean` predicate + a shared `CONSENT_REQUIRED_CODE = 'consent_required'` constant (Phase 6).

## 4. API Design

No new API is authored; all endpoints exist. Frontend consumption summary:

### 4.1 Policy documents (public, read)

- `GET /policy-documents/latest/privacy_policy/` → `PolicyDocument` (`200`) / `404` = not published → render placeholder. Server-side fetch.
- `GET /policy-documents/latest/terms_of_use/` → same shape. Server-side fetch.

### 4.2 Consent recording (authenticated, write)

- `POST /consents/` body `{ document_type: 'sms_consent', phone_number }` → `201 UserConsent`. Used by the change-phone flow. Errors: `401` unauthenticated; `400` unknown/unpublished document type → surface a clear "consent can't be recorded, verification unavailable" message.

### 4.3 Signup (public, write) — body additions

- `POST /auth/{client}/v1/auth/signup` — add `accepted_terms: true` + `accepted_sms_consent: true` to the existing email-signup body and the finish-signup (`provider_signup`) body. `400` with a field-level error on either → surface inline on that checkbox.

### 4.4 Gate refusal (any phone-verification request)

- `403` `{ errors: [{ code: 'consent_required' }] }` on verify/resend → detect via shared helper, route to consent step. No new endpoint.

## 5. Phased Rollout

Ordering: policy pages first (Phases 1–3) so signup checkboxes can link to real routes; then signup consent (Phases 4–5); then the consent-recording hook + change-phone + gate handling (Phases 6–8). No feature flag ⇒ no flag-removal phase.

---

### Phase 1 — Policy fetch + markdown render scaffolding

**Goal**: Ship value: none on its own — foundation. A `server-only` helper that fetches the latest policy document and a server util that renders `body_markdown` to sanitized HTML, plus a shared `PolicyDocumentView` server component. Consumed by Phases 2–3.

**Feature flag**: none — purely additive scaffolding, no reachable route yet.

Changes:

1. `package.json`: add `remark`, `remark-rehype`, `rehype-sanitize`, `rehype-stringify`, `unified` (server-side markdown → sanitized HTML). No client markdown renderer.
2. New `@src/lib/policy-documents-server.ts` (`import 'server-only'`): `fetchLatestPolicyDocument(type: DocumentTypeEnum): Promise<PolicyDocument | null>` — reads `NEXT_PUBLIC_API_BASE_URL`, GETs `/policy-documents/latest/{type}/`, returns `null` on `404`/network/parse failure. Mirror the failure-safe pattern in [branding-server.ts](../src/lib/branding-server.ts).
3. New `@src/lib/render-markdown.ts` (`import 'server-only'`): `renderMarkdownToSafeHtml(md: string): Promise<string>` via `unified().use(remarkParse).use(remarkRehype).use(rehypeSanitize).use(rehypeStringify)`.
4. New `@src/components/policy/policy-document-view.tsx` (server component): given a `PolicyDocument | null`, render `title` as heading, optional `version` / `published_at` ("Last updated …"), and the sanitized HTML; render a placeholder empty-state when `null`. Use layout primitives (`Box`, `Stack`, `Heading`, `Text`).

Spec use-case: shared scaffolding — no use-case yet (supports Privacy Policy page and Terms of Use page).

Tests:

- **Unit**: `@src/lib/render-markdown.test.ts` — renders headings/links/lists; strips `<script>` / `onerror` / `javascript:` URLs (sanitization proof).
- **Unit**: `@src/lib/policy-documents-server.test.ts` — `200` → parsed `PolicyDocument`; `404` → `null`; network error → `null` (mock `fetch`).

**Suggested AI model**: Tier 3 — `claude-sonnet-4-6`. Adds dependencies + a sanitization pipeline (security-sensitive) + a shared server component; correctness of the sanitizer matters.

**Reusable skills**: `new-composition` (for `policy-document-view.tsx`).

Acceptance: `fetchLatestPolicyDocument('privacy_policy')` returns a `PolicyDocument` on `200` and `null` on `404`; `renderMarkdownToSafeHtml` strips script/event-handler payloads; `PolicyDocumentView` renders a placeholder for `null`. No route is reachable yet.

---

### Phase 2 — Privacy Policy page (`/privacy`)

**Goal**: A public `/privacy` page renders the latest Privacy Policy markdown, or a placeholder when none is published.

**Feature flag**: none — brand-new public route, no existing code reads it.

Changes:

1. New route `@src/app/privacy/page.tsx` (server component): `await fetchLatestPolicyDocument('privacy_policy')` → `<PolicyDocumentView document={…} />`. Public — no auth wrapper.
2. Page metadata (title "Privacy Policy") for SEO.

Spec use-case: Privacy Policy page.

Tests:

- **Unit**: `@src/app/privacy/page.test.tsx` — renders policy content when present; renders placeholder when the fetch returns `null`.

**Suggested AI model**: Tier 2 — `claude-haiku-4-5`. Thin route consuming Phase 1 scaffolding.

**Reusable skills**: `new-page`.

Acceptance: Visiting `/privacy` without a session renders the latest Privacy Policy (or a placeholder on `404`); no error toast on `404`.

---

### Phase 3 — Terms of Use page (`/terms`)

**Goal**: A public `/terms` page renders the latest Terms of Use markdown, or a placeholder when none is published.

**Feature flag**: none — brand-new public route.

Changes:

1. New route `@src/app/terms/page.tsx` (server component): `await fetchLatestPolicyDocument('terms_of_use')` → `<PolicyDocumentView document={…} />`. Mirrors Phase 2.
2. Page metadata (title "Terms of Use").

Spec use-case: Terms of Use page.

Tests:

- **Unit**: `@src/app/terms/page.test.tsx` — content present vs placeholder (mirror Phase 2).

**Suggested AI model**: Tier 1 — `claude-haiku-4-5`. Near-exact precedent from Phase 2 (different `document_type` + copy).

**Reusable skills**: `new-page`.

Acceptance: Visiting `/terms` without a session renders the latest Terms of Use (or a placeholder on `404`).

---

### Phase 4 — Email/password signup consent checkboxes

**Goal**: The email/password signup form shows two distinct required consent checkboxes and sends `accepted_terms` + `accepted_sms_consent` in the signup POST; signup succeeds against the new backend contract.

**Feature flag**: none — required contract fix (backend rejects signup without these fields).

Changes:

1. [src/app/auth/signup/page.tsx](../src/app/auth/signup/page.tsx): extend `makeSignupSchema` with `accepted_terms: z.boolean().refine(v => v === true, { message: 'You must agree to the Privacy Policy and Terms of Use.' })` and `accepted_sms_consent: z.boolean().refine(v => v === true, { message: 'You must agree to receive SMS messages.' })`. Add two unchecked `FormField` checkboxes with the exact handoff copy; the terms checkbox links to `/privacy` and `/terms`. Include both in the POST body (they are already part of the `Signup` type). Do not pre-check either; do not strip them.
2. [src/hooks/authentication/use-sign-up.ts](../src/hooks/authentication/use-sign-up.ts): no signature change needed (body is passed through) — verify the two fields flow into `body` and are typed.

Spec use-case: Email / password signup consent.

Tests:

- **Unit**: `@src/app/auth/signup/page.test.tsx` — submit blocked with inline error when either box is unchecked; both fields sent as `true` in the POST body when checked; boxes are unchecked by default.

**Suggested AI model**: Tier 2 — `claude-haiku-4-5`. Established react-hook-form + zod pattern in one file.

**Reusable skills**: none.

Acceptance: Email signup is rejected with inline errors unless both checkboxes are checked; a checked submission POSTs `accepted_terms: true` + `accepted_sms_consent: true` and succeeds.

---

### Phase 5 — Social finish-signup consent checkboxes

**Goal**: The social (OAuth) finish-signup form shows the same two required consent checkboxes and sends both booleans in the `ProviderSignup` POST body.

**Feature flag**: none — `ProviderSignup` already requires the fields; the current finish-signup POST is broken until they are sent.

Changes:

1. [src/components/authentication/finish-signup-form.tsx](../src/components/authentication/finish-signup-form.tsx): add `accepted_terms` + `accepted_sms_consent` to the local zod schema (both `.refine(v => v === true)`), add two unchecked checkboxes with the handoff copy (terms linking to `/privacy` + `/terms`), and include both in the `providerSignup` body. Keep them visually/functionally distinct.
2. [src/hooks/authentication/use-provider-signup.ts](../src/hooks/authentication/use-provider-signup.ts): confirm the body passthrough types the two new fields.

Spec use-case: OAuth2 / social signup consent (captured in finish-signup per Guiding Decisions).

Tests:

- **Unit**: `@src/components/authentication/finish-signup-form.test.tsx` — submit blocked with inline errors unless both checked; both sent `true`; unchecked by default; pending-flow (`verify_phone`) routing still works.

**Suggested AI model**: Tier 2 — `claude-sonnet-4-6`. Touches a form + its hook + an existing pending-flow contract; needs care not to regress social callback routing.

**Reusable skills**: none.

Acceptance: Social finish-signup is rejected with inline errors unless both checkboxes are checked; a checked submission POSTs both booleans and completes the provider_signup flow (including `verify_phone` handoff).

---

### Phase 6 — Consent hook + `consent_required` detector

**Goal**: Ship value: none on its own — foundation. A `useCreateConsent` mutation hook wrapping `consentsCreateMutation`, and a shared `isConsentRequiredError` helper. Consumed by Phases 7–8.

**Feature flag**: none — additive scaffolding, no reachable behavior change.

Changes:

1. New `@src/hooks/consents/use-create-consent.ts`: wraps `consentsCreateMutation` from `@/client`, returns `{ createConsent, createConsentMutation }` (repo hook convention). Typed body `ConsentCreate`.
2. New `@src/lib/consent-errors.ts`: `CONSENT_REQUIRED_CODE = 'consent_required'` + `isConsentRequiredError(error: unknown): boolean` — safely inspects `errors[].code` on the allauth/API error shape (403).

Spec use-case: shared scaffolding — no use-case yet (supports change-phone consent and gate handling).

Tests:

- **Unit**: `@src/lib/consent-errors.test.ts` — matches a 403 `consent_required` payload; returns `false` for other error shapes / non-403 / missing `errors`.
- **Unit**: `@src/hooks/consents/use-create-consent.test.ts` — calls the generated mutation with `{ document_type: 'sms_consent', phone_number }` and surfaces `201` / `400` / `401`.

**Suggested AI model**: Tier 2 — `claude-haiku-4-5`. Thin hook mirroring existing wrappers + a small pure predicate.

**Reusable skills**: `new-hook` (for `use-create-consent.ts`).

Acceptance: `useCreateConsent` POSTs a `ConsentCreate` body and returns the `UserConsent`; `isConsentRequiredError` returns `true` only for a 403 `consent_required` payload. Nothing user-facing changes.

---

### Phase 7 — Change-phone consent recording

**Goal**: When a signed-in user changes to a new phone number, the app records `sms_consent` for that phone (`POST /consents/` with `phone_number`) before requesting a verification code for it.

**Feature flag**: none — additive within the existing change-phone flow; behavior only differs for a newly-submitted phone.

Changes:

1. [src/components/account-security/phone-section.tsx](../src/components/account-security/phone-section.tsx) / [src/hooks/authentication/use-update-phone.ts](../src/hooks/authentication/use-update-phone.ts): before triggering the verification-code request for a new phone, call `createConsent({ document_type: 'sms_consent', phone_number: <newPhone> })`. Surface a clear message on `400` (consent can't be recorded → verification unavailable). Add a brief SMS-consent acknowledgement near the phone-change control.
2. Sequence so consent resolves before the code request fires (await the consent mutation, then request the code).

Spec use-case: Login-by-phone and change-phone — change-phone portion only.

Tests:

- **Unit**: `@src/components/account-security/phone-section.test.tsx` — changing to a new phone POSTs `sms_consent` with that `phone_number` before the code request; `400` shows the failure message and does not request a code.

**Suggested AI model**: Tier 3 — `claude-sonnet-4-6`. Coordinates a mutation ordering (consent → code) across a component + hook with an error branch.

**Reusable skills**: none.

Acceptance: Submitting a new phone in account security records `sms_consent` for that phone before any verification-code request; a `400` on consent blocks the code request with a clear message.

---

### Phase 8 — `consent_required` gate handling on verification

**Goal**: A `403 consent_required` from a phone-verification or resend request routes the user to record consent (with the relevant phone) and retry, instead of a generic error.

**Feature flag**: none — additive error handling on existing requests; no change to the success path.

Changes:

1. [src/hooks/authentication/use-verify-phone.ts](../src/hooks/authentication/use-verify-phone.ts), [src/hooks/authentication/use-resend-phone-verification-code.ts](../src/hooks/authentication/use-resend-phone-verification-code.ts), and the verify-phone page [src/app/auth/verify-phone/page.tsx](../src/app/auth/verify-phone/page.tsx): on error, if `isConsentRequiredError(error)`, record `sms_consent` for the phone under verification (via `useCreateConsent`) then retry the original request; otherwise show the existing error UI. Reuse the same recovery in the change-phone flow (Phase 7 surface).
2. Present a short consent acknowledgement in the recovery path before re-requesting the code.

Spec use-case: The consent gate (`403 consent_required`) — frontend detection + recovery.

Tests:

- **Unit**: `@src/app/auth/verify-phone/page.test.tsx` — a 403 `consent_required` triggers a `POST /consents/` (with the phone) then a retry; a non-consent error falls through to the normal error UI.
- **Unit**: resend hook test — same 403 → consent → retry path.

**Suggested AI model**: Tier 3 — `claude-sonnet-4-6`. Error-branch coordination across multiple hooks + a page, with a retry sequence.

**Reusable skills**: none — consumes Phase 6 scaffolding.

Acceptance: A phone-verification/resend request that returns `403 consent_required` records `sms_consent` for that phone and retries automatically; other errors are unaffected.

---

## 6. Risk & Rollout Notes

- **No feature flag.** Phases 4 and 5 are contract fixes: until they merge, signup / finish-signup POSTs are rejected by the backend for missing required fields. Prioritize Phases 4–5; they are independently mergeable (email vs social) and each keeps its own flow working. Phases 1–3 (policy pages) are prerequisites only for the checkbox _links_, not for the POST body — if a page phase slips, the checkbox copy can ship with the links pointing at the (soon-to-exist) routes, but prefer merging pages first.
- **Markdown sanitization is security-sensitive.** `body_markdown` is admin-authored but must be sanitized server-side (`rehype-sanitize`) before injection. The Phase 1 unit test asserting script/event-handler stripping is the guard; do not weaken the schema to allow raw HTML.
- **Dependency addition** (Phase 1): new `remark`/`rehype`/`unified` packages. Lockfile is npm 11 / Node 24 — install with the matching toolchain to avoid `EUSAGE` (see [CI Node/npm memory](../.claude/projects/-Users-hugobessa-Workspaces-vinta-schedule-frontend-web/memory/ci-node-npm-version.md)).
- **Phone verification currently disabled server-side** (`ACCOUNT_PHONE_VERIFICATION_ENABLED = False`). The consent capture + gate detection are safe to ship now; the 403 path (Phase 8) becomes live when the setting is flipped. No frontend redeploy required at flip time.
- **Anti-enumeration silence** (handoff §3c): the frontend must not build "check your phone" UI that assumes SMS delivery for a phone the user hasn't consented for — the backend silently sends nothing. Change-phone (Phase 7) records consent _first_, so this app's own flows always consent before expecting delivery.
- **Rollback**: each phase is a plain revert. Reverting Phases 4–5 re-breaks signup against the new backend, so they should not be reverted without a coordinated backend rollback of the required-field change.
- **No migrations, no locks, no backfill** (frontend-only).
- **Format-churn guard**: implementer subagents may reformat unrelated files — restore churn before committing (see [implementer format:fix memory](../.claude/projects/-Users-hugobessa-Workspaces-vinta-schedule-frontend-web/memory/implementer-format-fix-churn.md)).

## 7. Open Questions

| Question                                                                                                               | Recommended default                                                                                                                          | Owner           |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Should already-authenticated social users who never hit finish-signup get a standalone `POST /consents/` interstitial? | Defer (out of scope). Add a post-login consent guard in a follow-up if analytics show such users reaching phone verification unconsented.    | Product         |
| Do policy pages need visible `version` / "Last updated" metadata?                                                      | Show it (small, unobtrusive) — cheap and useful. Confirm copy with Product.                                                                  | Product         |
| When login-by-phone ships, where does its consent step live?                                                           | Mirror change-phone: record `sms_consent` for the submitted phone before the code request. Plan then.                                        | Eng             |
| Should the change-phone SMS-consent acknowledgement be a checkbox (like signup) or an inline notice?                   | Inline acknowledgement notice (the user is already authenticated and initiating the change); revisit if legal requires an explicit checkbox. | Product / Legal |

## 8. Touch List

**Phase 1 — scaffolding**

- Create `@src/lib/policy-documents-server.ts`
- Create `@src/lib/render-markdown.ts`
- Create `@src/components/policy/policy-document-view.tsx`
- Create `@src/lib/render-markdown.test.ts`, `@src/lib/policy-documents-server.test.ts`
- Edit [package.json](../package.json) (+`remark`, `remark-rehype`, `rehype-sanitize`, `rehype-stringify`, `unified`)

**Phase 2 — Privacy page**

- Create `@src/app/privacy/page.tsx`, `@src/app/privacy/page.test.tsx`
- Edit [QA_USE_CASES.md](../QA_USE_CASES.md)

**Phase 3 — Terms page**

- Create `@src/app/terms/page.tsx`, `@src/app/terms/page.test.tsx`
- Edit [QA_USE_CASES.md](../QA_USE_CASES.md)

**Phase 4 — Email signup consent**

- Edit [src/app/auth/signup/page.tsx](../src/app/auth/signup/page.tsx)
- Edit [src/hooks/authentication/use-sign-up.ts](../src/hooks/authentication/use-sign-up.ts) (verify only)
- Create `@src/app/auth/signup/page.test.tsx`
- Edit [QA_USE_CASES.md](../QA_USE_CASES.md)

**Phase 5 — Social finish-signup consent**

- Edit [src/components/authentication/finish-signup-form.tsx](../src/components/authentication/finish-signup-form.tsx)
- Edit [src/hooks/authentication/use-provider-signup.ts](../src/hooks/authentication/use-provider-signup.ts) (verify only)
- Create `@src/components/authentication/finish-signup-form.test.tsx`
- Edit [QA_USE_CASES.md](../QA_USE_CASES.md)

**Phase 6 — Consent hook + detector**

- Create `@src/hooks/consents/use-create-consent.ts`, `@src/lib/consent-errors.ts`
- Create `@src/hooks/consents/use-create-consent.test.ts`, `@src/lib/consent-errors.test.ts`

**Phase 7 — Change-phone consent**

- Edit [src/components/account-security/phone-section.tsx](../src/components/account-security/phone-section.tsx)
- Edit [src/hooks/authentication/use-update-phone.ts](../src/hooks/authentication/use-update-phone.ts)
- Create `@src/components/account-security/phone-section.test.tsx`
- Edit [QA_USE_CASES.md](../QA_USE_CASES.md)

**Phase 8 — Gate handling**

- Edit [src/hooks/authentication/use-verify-phone.ts](../src/hooks/authentication/use-verify-phone.ts), [src/hooks/authentication/use-resend-phone-verification-code.ts](../src/hooks/authentication/use-resend-phone-verification-code.ts), [src/app/auth/verify-phone/page.tsx](../src/app/auth/verify-phone/page.tsx)
- Create `@src/app/auth/verify-phone/page.test.tsx` (+ resend hook test)
