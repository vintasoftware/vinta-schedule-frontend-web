# Tracking — Public API Documentation Site

**Feature**: Public API Documentation Site
**Plan**: [ai-plans/2026-07-16-PUBLIC_API_DOCS_IMPLEMENTATION_PLAN.md](2026-07-16-PUBLIC_API_DOCS_IMPLEMENTATION_PLAN.md)
**Started**: 2026-07-16
**Last updated**: 2026-07-17
**Feature flag**: none — the plan deliberately ships without one (purely additive public surface; see the plan's Risk & Rollout Notes).

## Run options

| Option | Value |
| --- | --- |
| `commit_strategy_resolved` | `stacked-branches` — one branch + PR per phase |
| `pause_between_phases` | `false` — auto-flow |
| `generate_inline_comments` | `false` — PR description only |
| `full_test_suite` | `false` — scoped tests per phase (outer gate always runs repo-wide typecheck) |
| `run_e2e` | `false` — no phase in this plan carries a Playwright spec |
| `use_worktree` | `true` |
| `worktree_path` | `.claude/worktrees/plan-public-api-docs` |
| `worktree_branch` | `plan-public-api-docs` (based on `origin/main` @ `7f9ca6d`) |
| `worktree_summary` | `.vinta-ai-workflows/worktrees/plan-public-api-docs.yaml` |
| `sandbox_tier` | `none` (intended `enforced`) — see note below |

**Sandbox note.** The worktree summary was first written as `enforced`, but the effective tier for this run is `none`: the conductor session is rooted in the main checkout, and claude-code reads the worktree's PreToolUse write-guard settings only at session start, so the guard cannot bind to in-process subagents here. Prevention falls back to review-phase's post-run `git -C <main_checkout> status` stray-write check, which is run after every implementer and fixer. It has been clean for every agent so far.

**Deps note.** The project config sets `deps_strategy: symlink`, but this plan adds dependencies (`rehype-highlight` in Phase 1, GraphiQL in Phase 5) and a symlinked `node_modules` would make `pnpm add` write into the main checkout. At the user's direction the symlink was replaced with a real per-worktree install (`pnpm install --frozen-lockfile`, typecheck verified). Phase agents may run `pnpm add` normally.

## Completed Phases

### Phase 0 — Docs shell, routing, and nav scaffold ✅

- **Status**: complete, reviewed, pushed
- **Branch**: `plan/public-api-docs/phase-0` (base: `plan-public-api-docs`)
- **Models**: implementer `claude-sonnet-4-6` (plan suggested Tier 2 haiku, "step to sonnet — touches 5 files + layout wiring"; straddling suggestion resolves to the higher tier). Reviewer `claude-sonnet-4-6` (Tier 3). Fixers `claude-haiku-4-5` (Tier 2).
- **E2E**: none (`run_e2e = false`; phase carries no spec)

**Summary.** Adds the public `/docs` section as a sibling of `privacy`/`terms`, outside the `(app)` auth group, so it renders for anonymous visitors. Five new source files plus tests and stories:

- `src/lib/docs/nav.ts` — `DocsNavItem` / `DocsNavSection` types and the static `DOCS_NAV` array covering all five sections (Getting Started, Schema Reference, Concepts, Webhooks, Explorer). `description` lives on `DocsNavSection` only, so Phases 2/3 can append generated children without inventing descriptions for them. This module is the single source of truth for both the sidebar and the landing page's section list.
- `src/components/docs/docs-sidebar.tsx` — renders `DOCS_NAV` via the design-system `Sidebar`/`SidebarGroup`/`SidebarItem` primitives; active state via `usePathname`, using the same exact-or-sub-route rule as `AppSidebar`. Already handles a `children` sub-nav level that no section populates yet.
- `src/components/docs/docs-prose.tsx` — `DocsProse`, the prose wrapper for docs content. Style string is a byte-identical extraction of the one inlined in `policy-document-view.tsx`. Takes `html` (pre-sanitized) or `children` as a discriminated union — passing both is a type error, verified empirically.
- `src/app/docs/layout.tsx` — public shell: sidebar beside a prose-width main column, following the `AppShell` precedent (`Container` nested inside a `grow`/`minWidth={0}` `Box`) so `Container` stays the single source of the width tokens.
- `src/app/docs/page.tsx` — overview page, section list driven by `DOCS_NAV`.

**Key decisions.**
- Nav hrefs point at routes that 404 until Phases 1–5 land. Deliberate per the plan's static-nav decision; **relevant to merge order** — merging phase 0 alone ships a sidebar of mostly-dead links.
- `policy-document-view.tsx` was NOT refactored to consume `DocsProse`; the style string is duplicated in two places for now. Reviewer logged this as a NIT to close in Phase 1 when `DocsProse` gets its first real caller.

**Review.** No BLOCKERs. Four SHOULD-FIX findings, all fixed in-phase across three commits:
1. Layout hand-rolled `maxWidth='68ch'` / `maxWidth={1200}`, duplicating `MAX_WIDTH.prose` / `MAX_WIDTH.contained` — reworked to compose `Container` per the `AppShell` precedent.
2. `SECTION_DESCRIPTIONS` was a parallel `Record` keyed by a widened `string`, so a new nav section would silently render `undefined` — descriptions folded into `nav.ts`; omitting one is now a type error.
3. `DocsProse`'s `html`/`children` exclusivity was comment-only — now a discriminated union.
4. `DocsProse` had no story and no test, contra AGENTS.md — both added.

Open NITs deferred (not blocking): sidebar has no `position='sticky'` and will scroll out of view once Phases 2/3 add long content; `policy-document-view.tsx` still carries the duplicate prose string; `/docs/page.tsx` has no direct test.

**Gates.** `pnpm run typecheck` green (both workspaces). Full suite green: 1045 app tests / 118 files, 82 design-system tests / 11 files. `next build` emits `/docs` as a static route. Prettier clean on all phase files. Main checkout clean — no stray writes. No AI co-author trailers.

### Phase 1 — Getting-started + auth guide ✅

- **Status**: complete, reviewed, pushed
- **Branch**: `plan/public-api-docs/phase-1` (base: `plan/public-api-docs/phase-0`)
- **Models**: implementer `claude-haiku-4-5` (plan Tier 2). Reviewer `claude-sonnet-4-6` (Tier 3), run twice — a second focused pass covered the api-tokens change no reviewer had seen. Fixers: `claude-haiku-4-5` (Tier 2) for the trivial ones, **escalated to `claude-sonnet-4-6`** for the sanitize pipeline and the loop regression after Haiku demonstrated a clear capability gap on both.
- **E2E**: none (`run_e2e = false`)
- **New dependency**: `rehype-highlight@^7.0.2` — SPDX **MIT**, cleared against the forbidden list.

**Summary.** Adds `/docs/getting-started`, the docs markdown pipeline with syntax highlighting, and — by user decision — a change to the api-tokens dialog that makes the documented auth flow actually completable.

- `src/lib/render-markdown.ts` now exports `createMarkdownProcessor()` and `extendSanitizeSchema()`. Both the policy pipeline and the docs pipeline share them, so sanitization is configured in exactly one place.
- `src/lib/docs/render-doc-markdown.ts` adds `rehype-highlight` and extends the schema to permit only the classes that plugin emits: `code: [['className', /^(language-|hljs)/]]`, `span: [['className', /^hljs-/]]`. It does not touch the wildcard entry.
- `src/app/docs/getting-started/content.ts` — the guide, as a template-string module. **Phases 2–5 should copy this shape** for their own content: a `.ts` module import is bundled normally, with no `process.cwd()`-relative `fs` read for Next's file tracing to miss.
- `src/components/api-tokens/new-token-dialog.tsx` — shows `${result.id}:${result.token}` as one credential string, which is exactly what goes after `Bearer `.

**Key decisions.**
- **The auth header is `Bearer <system_user_id>:<token>`, confirmed against the backend** (`public_api/middlewares.py:23-42` splits on the first `:`, `int()`-parses the left half; `services.py:40` looks it up via `SystemUser.original_manager.get(id=...)`). It is NOT `<organization_id>:<token>` — a `SystemUser` is organization-scoped but its `id` is its own PK.
- **The dialog composes the credential rather than surfacing the id separately** (user's call). The two halves are never useful apart, and the middleware splits them back. This expanded scope beyond the plan's Phase 1 touch list into `src/components/api-tokens/`, deliberately and with user approval — without it, the guide documented a flow no reader could complete, because the dialog discarded `result.id`.

**Review — this phase needed real work. Findings, all fixed:**
1. **BLOCKER — the pipeline copy-pasted `render-markdown.ts` instead of extending it**, duplicating security-critical sanitization. The implementer's report claimed "no deviations", which was false. Now shares one chain.
2. **BLOCKER — the sanitize schema was silently corrupted.** `JSON.parse(JSON.stringify(defaultSchema))` turned `defaultSchema.attributes.code`'s RegExp (`/^language-./`) into `{}`, matching nothing, so `<code>` rendered `class=""` and lost all highlighting. The workaround for that symptom had been to allow `className` on `*` — every element — which would have been inherited by Phase 3's semi-trusted backend content. Replaced with a spread-based merge that leaves the RegExp entries untouched, scoped to `code`/`span`.
3. **BLOCKER — 3 of 4 sanitize tests were vacuous**: they passed identically with `rehype-sanitize` deleted, because `remark-rehype` drops raw HTML before the sanitizer ever runs. Rewritten to inject hast trees directly through the schema; each was proven to fail with the sanitizer removed.
4. **BLOCKER — the mutation example was invalid** against the live schema (`createCalendarGroupEvent` returns a `CalendarGroupEventResult`; the fields only exist under `event { ... }`). Fixed.
5. **SHOULD-FIX — the example id was non-numeric** (`user-123`), which `int()` would reject. Now `42`.
6. **SHOULD-FIX — the query omitted the required `search_window_end`.** Fixed in the docs.
7. **SHOULD-FIX — the guide never mentioned selecting scopes**, though the dialog's zod schema requires `available_resources.min(1)`. Found by a fixer reading past its assignment.
8. **SHOULD-FIX — the composed credential stayed readable after the dialog closed** via the retained TanStack mutation `data`, contradicting the file's own "never in global state" comment. Now calls `reset()` on close.
9. **Regression caught in review, not shipped**: the fix for (8) put the mutation object in a `useEffect` dep array. `useMutation` returns a new identity every render, so the effect looped and exhausted the heap — the api-tokens suite crashed at 10/19 after 253s. That fixer misread the truncated output as a pass. Fixed by depending on the stable bound `reset` method, with a `Profiler`-based regression test proven to hang when the fix is reverted.

**Carried forward — needs action outside this phase.**
- **`marketing-home.tsx`'s showcase query is also invalid**: `src/components/home-page/marketing-home.tsx:448-460` calls `calendarGroupBookableSlots` without the required `searchWindowEnd`. Left untouched (Phase 6 owns that file), but **Phase 6 should fix it** — it's a public-facing sample that would fail validation.
- Known, accepted: the raw `Mutation` entry survives in `QueryClient`'s `MutationCache` until its 5-minute `gcTime`, independent of `reset()`. A property of TanStack Query, not this component; visible only via Query DevTools.

**Gates.** typecheck green. Full suite green: 1056 app tests / 119 files, 82 design-system / 11 files. `next build` emits `/docs/getting-started` static. Prettier clean on phase files. Main checkout and the backend repo both clean — no stray writes. No AI co-author trailers.

### Phase 2 — GraphQL schema reference from live introspection ✅

- **Status**: complete, reviewed, pushed
- **Branch**: `plan/public-api-docs/phase-2` (base: `plan/public-api-docs/phase-1`)
- **Models**: implementer `claude-sonnet-4-6` (plan Tier 3). Reviewer `claude-sonnet-4-6` (Tier 3). Fixer **escalated to `claude-sonnet-4-6`** from the configured Tier 2 — Haiku had already misread test counts and shipped an infinite loop earlier in this run.
- **E2E**: none (`run_e2e = false`)
- **New dependency**: none. The introspection query and its TS types are hand-rolled; `graphql` was deliberately not added.

**Summary.** `/docs/reference` renders the public GraphQL schema — an index of all queries and mutations plus 137 per-type detail pages, fully static.

- `src/lib/docs/__generated__/graphql-schema.json` — the committed snapshot, generated for real against the live local backend. Verified genuine: 151 types, `Query`/`Mutation` roots, contains both `calendarGroupBookableSlots` and `createCalendarGroupEvent`.
- `scripts/refresh-graphql-schema-snapshot.mjs` (`pnpm run docs:refresh-schema-snapshot`) — regenerates the snapshot deliberately, failing loudly on error.
- `src/lib/docs/introspect-schema.ts` — attempts one live fetch (memoized per build so ~140 pages share it), falls back to the committed snapshot with a warning.
- `src/lib/docs/parse-schema.ts` — introspection JSON → `GraphQLSchemaModel`.
- `src/app/docs/reference/[[...slug]]/page.tsx` + three components under `src/components/docs/`.

**Key decisions.**
- **The build does NOT write the snapshot**, contrary to the plan's literal step 1. A mid-build write into `src/` doesn't persist on Vercel and the module graph is already bundled by render time, so it would silently no-op in production while appearing to work locally. Instead the snapshot is a committed artifact refreshed by an explicit script, and the build only reads it. The reviewer independently validated this reasoning.
- **`generateStaticParams` is filtered**: drops `__`-prefixed meta types, the five built-in scalars, and the `Query`/`Mutation` roots; keeps OBJECT/INPUT_OBJECT/ENUM → 137 pages. INTERFACE/UNION have zero occurrences in this schema and are not supported, but now warn loudly if one ever appears.
- **Queries and mutations render in full on the index**, not as 82 separate routes. "Per-type detail" was read as applying to types only.
- **The backend was reachable locally during this phase** (`localhost:8000` answered introspection), so the live path was genuinely exercised, not just the fallback.

**Review.** No BLOCKERs. Four SHOULD-FIX, all fixed:
1. **The live-fetch `try/catch` swallowed everything into one generic "unreachable" warning.** This pattern had already hidden one real bug (below), and would misreport a future code defect as an infra problem while docs silently froze at snapshot state forever. Now logs distinguishable messages per failure mode — non-2xx, malformed JSON, GraphQL errors, missing `__schema`, timeout, and a catch-all that dumps the actual error.
2. **`defaultValue` was parsed but never rendered** — non-null in 149 places in the real schema, so readers couldn't learn that e.g. `limit` defaults to `100` without reading backend source. Now rendered.
3. INTERFACE/UNION types would have been dropped silently. Now warned.
4. `schema-field-list.tsx` had no test; its deprecated-badge path was covered by no test anywhere. Added, and **every new test was proven able to fail** by temporarily breaking the branch it covers.

**Caught during implementation, worth remembering.** The first draft passed `cache: 'no-store'` to the introspection fetch. Next's static-generation-patched `fetch` throws `DYNAMIC_SERVER_USAGE` for that inside a prerendered page — which the broad `try/catch` swallowed as "backend unreachable", so it *always* used the snapshot even with the backend up, and demoted the whole route from static to dynamic-per-request. Removed. This is why finding 1 above mattered.

**Fallback verified by the conductor, not just reported**: `NEXT_PUBLIC_API_BASE_URL=http://localhost:59999 pnpm run build` → exit 0, warning emitted, route still `●` (fully static), built output still contains the real operations from the snapshot. This is the path production takes today, since the backend is not deployed.

**Open NIT deferred**: the three "Schema Reference" sub-nav children are hash-fragment links (`/docs/reference#queries`), which can never match `DocsSidebar`'s `isActive` check since `usePathname()` never contains a hash. Cosmetic; links navigate correctly.

**Gates.** typecheck green. Full suite green: 1089 app tests / 124 files, 82 design-system / 11 files. Build passes with and without a reachable backend. Prettier clean on phase files. Main checkout and backend repo clean. No AI co-author trailers.

### Schema sync — backend contract refresh ✅

- **Status**: complete, pushed as PR #71 (base `main`)
- **Branch**: `plan/public-api-docs/schema-sync`

The backend (`~/Workspaces/vinta-schedule`) shipped Phase 1b, 2b, and the webhook-events endpoint (backend plan PRs #186, #187, #188). This branch refreshes the tracked `schema.yml` from the backend and regenerates `src/client`. The `schema.yml` diff is huge (~13.8k lines) but almost entirely a YAML-emitter reindentation from a backend drf-spectacular/PyYAML bump — the real generated-client change is 344 lines, all six new `public_api_docs_*` operations. The docs site consumes those endpoints via plain `fetch`, not the generated client, so the operations are carried only to keep the contract in sync. Phase 3 stacks on this branch.

### Phase 3 — Concept guides fetched from backend ✅

- **Status**: complete, reviewed, pushed
- **Branch**: `plan/public-api-docs/phase-3` (base: `plan/public-api-docs/schema-sync`)
- **Models**: implementer `claude-sonnet-4-6` (plan Tier 3). Reviewer `claude-sonnet-4-6` (Tier 3). Fixer `claude-sonnet-4-6` (escalated from Tier 2 for the security-relevant link classifier).
- **E2E**: none (`run_e2e = false`)
- **New dependency**: none.

**Summary.** `/docs/concepts/<slug>` renders the six backend concept guides, fetched at build time with the same resiliency shape as Phase 2.

- `src/lib/docs/fetch-concepts.ts` — mirrors `introspect-schema.ts`: explicit 8s timeout, memoized per build, per-failure-mode warnings, whole-or-nothing (a single failed doc fetch discards the whole live result for the snapshot, so a partial set can't 404 a nav link), never throws.
- `src/lib/docs/rewrite-links.ts` — the rehype pass that rewrites in-docs `.md` cross-links to `/docs/concepts/<slug>` and neutralizes everything else (backend source files, unported docs, protocol-relative URLs) to a plain `<span>`. Threaded into the shared pipeline (rewrite → highlight → sanitize → stringify), not forked.
- `src/lib/docs/__generated__/concepts.json` + `concepts-manifest.json` — committed snapshots generated from the live endpoint. Split so `nav.ts` (bundled into the client `DocsSidebar`) imports a markdown-free manifest, keeping ~40KB of prose out of the client bundle.
- `scripts/refresh-concepts-snapshot.mjs` (`pnpm run docs:refresh-concepts-snapshot`) — regenerates both snapshots.
- `src/app/docs/concepts/[slug]/page.tsx` + `src/app/docs/concepts/page.tsx` (index) — the index closes a Phase 0 gap where the "Concepts" nav entry pointed at a route that 404'd.

**The backend endpoint was live for this phase** — the user built it in the backend repo first, then had the conductor start the backend (`make up`), so the live fetch path was genuinely exercised, not just the snapshot. Both paths verified.

**Review.** No BLOCKERs. Two SHOULD-FIX, both fixed:
1. **Protocol-relative URLs (`//evil.com`) misclassified as `leave`** — they passed the site-relative branch, and rehype-sanitize doesn't strip protocol-relative URLs, so a `//host` link in a concept doc would have rendered as a working off-origin link disguised as in-page. Not reachable with today's six docs, but wrong on semi-trusted content. Now neutralized; conductor re-verified independently.
2. **Sidebar manifest and content snapshot could drift** — documented the asymmetry in `nav.ts` and added a regression test asserting the two committed snapshots have identical slug sets.
Plus a NIT taken: `fetchDoc` verifies the returned `doc.slug` matches the requested slug, treating a mismatch as a failed fetch → snapshot fallback.

**Fallback verified against real build output**: `NEXT_PUBLIC_API_BASE_URL=http://localhost:59999 pnpm run build` → exit 0, both snapshots warn and kick in, `/docs/concepts/[slug]` renders `●` with real content, cross-links rewritten, no dead source `<a>` links.

**Gates.** typecheck green. Full suite green: 1119 app tests / 126 files, 82 design-system / 11 files. Build passes with and without a reachable backend. Prettier clean. Main checkout and backend repo clean. No AI trailers.

### Phase 4 — Webhooks reference ✅

- **Status**: complete, reviewed, pushed
- **Branch**: `plan/public-api-docs/phase-4` (base: `plan/public-api-docs/phase-3`)
- **Models**: implementer `claude-haiku-4-5` (plan Tier 2). Reviewer `claude-sonnet-4-6` (Tier 3). Fixer `claude-sonnet-4-6` (escalated from Tier 2 — the BLOCKER needed the delivery semantics stated correctly against the backend).
- **E2E**: none (`run_e2e = false`)
- **New dependency**: none.

**Summary.** `/docs/webhooks` documents the seven outbound webhook event types, fetched from the backend catalog (not hand-authored — the decision reversed once the backend gained descriptions), and links to the webhook GraphQL config types in the Phase 2 reference.

- `src/lib/docs/fetch-webhook-events.ts` — fetches `GET /public-api-docs/webhook-events/`, mirroring Phase 3's resiliency shape exactly (8s timeout, memoized, per-failure warnings, whole-or-nothing, never throws).
- `src/lib/docs/__generated__/webhook-events.json` — committed snapshot, generated from the live endpoint (7 events).
- `scripts/refresh-webhook-events-snapshot.mjs` (`pnpm run docs:refresh-webhook-events-snapshot`).
- `src/app/docs/webhooks/page.tsx` — the reference page; links to `WebhookConfigurationGraphQLType` and `WebhookEventGraphQLType` (both verified present in the schema snapshot, so the links resolve).

**Decision reversed from the plan.** The plan hand-authored the list; the backend now serves it with real descriptions, so this fetches it. Descriptions are plain prose, rendered as text (no markdown pipeline needed, no HTML injection). The frontend plan body still says "hand-author" — it should be amended via `amend-plan`, or the divergence is at least recorded here and in the PR.

**Review — one BLOCKER, caught and fixed.**
1. **BLOCKER: the page invented a delivery guarantee the backend does not provide.** It stated "Events are delivered in chronological order", but the backend dispatches each event independently via Celery with exponential-backoff retries (up to 5) — out-of-order delivery is by design. An integrator trusting this would skip ordering/dedup logic against a false promise. The fixer verified against `webhook_service.py`/`tasks.py`, traced the `main_event` chain to confirm the envelope `id` is stable across retries, and rewrote it to state only what's true: at-least-once, retried with backoff, no ordering guarantee, dedupe on the envelope `id`. Conductor re-read the corrected wording.
2. **SHOULD-FIX: DESIGN.md violations** — the page hand-rolled raw `<div>`/`<ul>`/`<li>` with Tailwind utility classes instead of design-system primitives (the pattern Phase 0 flagged). Migrated to `Box`/`Stack`/`Flex`/`List`/`ListItem` with confirmed (not guessed) token prop names. Plus a NIT (redundant `text-xs` on a Badge).

**Process note.** The implementer staged its work but never ran `git commit`, reporting "ready for review" with the changes only in the index. The conductor verified the staged work (gate green) and committed it. Worth watching for in future phases.

**Fallback verified by the conductor**: `NEXT_PUBLIC_API_BASE_URL=http://localhost:59999 pnpm run build` → exit 0, webhook-specific warning, `/docs/webhooks` renders `○` with all 7 events from the snapshot. Content survival through the DS-primitive refactor was grep-confirmed in the built HTML.

**Gates.** typecheck green. Docs scope deterministically green (90/90). Full suite 1129 app / 128 files + 82 design-system — note the repo has a **known intermittent timer-based flake** (`phone-verify-dialog.test.tsx` and similar) unrelated to this change; it failed 1 of 3 full-suite runs and passed the other two, while the docs scope is 90/90 every run. Build passes with and without a backend. Prettier clean. Main checkout and backend repo clean. No AI trailers.

## Current Phase

Phase 5 — Embedded GraphiQL explorer (next). Adds GraphiQL (check SPDX license before install); token is session-only, not persisted to localStorage; needs backend CORS (shipped) for real cross-origin calls.

## Remaining Phases

| Phase | Title | Tier | Notes |
| --- | --- | --- | --- |
| 4 | Webhooks reference | 2 | **Decision reversed from the plan.** The plan hand-authored the seven event types; the backend now serves them with real descriptions at `GET /public-api-docs/webhook-events/` → `[{value, label, description}]` (backend PR #188, live at localhost:8000, 7 events, verified). **Fetch it** with the same fetch/snapshot/fallback shape as Phase 3 (a `webhook-events.json` snapshot + a refresh script), instead of hard-coding the list. The generated client already has `WebhookEventDoc` + `publicApiDocsWebhookEventsList` from the schema sync. This diverges from the plan body and its Open Questions default — the plan file itself should be amended (via `amend-plan`) to match, or at least this divergence noted in the Phase 4 PR. |
| 5 | Embedded GraphiQL explorer | 3 | Adds GraphiQL. **Check its SPDX license before installing** — the repo blocks GPL-2.0-only / GPL-3.0-only / AGPL-3.0-only / SSPL-1.0. Honor the plan's token-safety note: do not persist the token to localStorage by default; offer a visible "clear token" affordance. Backend Phase 1b (CORS + introspection) shipped, so the explorer's cross-origin calls work against the running dev backend now, and against prod once `schedule.vintasoftware.com` / `schedule-staging.vintasoftware.com` are added to the backend's `CORS_ALLOWED_ORIGINS` env (backend plan Risk notes — a Render env edit, not code). |
| 6 | Wire landing-page links to `/docs` | 1 | Mechanical href edits in `marketing-home.tsx`. **Also fix the invalid query there** — `marketing-home.tsx:448-460` calls `calendarGroupBookableSlots` without the required `searchWindowEnd`; see Carried Forward under Phase 1. |

## Patterns later phases must follow

- **Authored prose lives in a real `.md` file**, imported with `?raw`, NOT a `.ts` template string. See `src/app/docs/getting-started/content.md` + `page.tsx`. The import needs Next's inline-loader import attributes and the ambient declaration in `raw-md.d.ts`:
  ```ts
  import content from './content.md?raw' with { turbopackLoader: 'raw-loader', turbopackAs: '*.js' };
  ```
  **Do not** use bare `./x.md?raw` (Turbopack: `Unknown module type`) and **do not** use a `turbopack.rules` `type: 'raw'` rule — that one builds successfully but silently resolves to `undefined`, giving an empty page with no error. Both were verified empirically. Vitest resolves `?raw` natively and ignores the `with {...}` attribute, so one import statement serves both toolchains.
- **Markdown rendering** goes through `renderDocMarkdownToSafeHtml` from `src/lib/docs/render-doc-markdown.ts` (sanitized + highlighted), rendered via `DocsProse`'s `html` prop. Never re-declare a unified pipeline; the shared chain is exported from `src/lib/render-markdown.ts`.
- **Fetch + snapshot + fallback**: follow `src/lib/docs/introspect-schema.ts`. Live fetch with an explicit timeout, memoized per build, distinguishable per-failure-mode warnings, never throws, never breaks the build. Snapshot is a committed artifact refreshed by an explicit script — the build reads, it does not write.
- **Do not pass `cache: 'no-store'`** to a fetch inside a prerendered page — it throws `DYNAMIC_SERVER_USAGE` and demotes the route from static to dynamic.
- **Tests must be able to fail.** Verify each new test by temporarily breaking the branch it covers. This plan has already shipped one batch of tests that passed with the code under test deleted.

## Deferred Phases

### Phase 1b — Backend: allow docs origin + confirm introspection (cross-repo)

Lives in `~/Workspaces/vinta-schedule`, so this conductor does not implement it. Adds the docs origin to `CORS_ALLOWED_ORIGINS` and asserts introspection is reachable. **Must be deployed before** Phase 2's build introspects a live backend and before Phase 5's explorer makes real cross-origin calls. Neither phase is blocked from landing in-repo — both fall back to snapshots / work against a local dev backend.

### Phase 2b — Backend: concept-docs serving endpoint (cross-repo)

Lives in `~/Workspaces/vinta-schedule`. Serves `docs/concepts/*.md` over `GET /public-api-docs/` and `GET /public-api-docs/{slug}/`. **Must be deployed before** Phase 3's build fetches concept docs. Phase 3 can still land using its committed snapshot.

Both backend phases need separate PRs in that repo and are tracked there, not here.
