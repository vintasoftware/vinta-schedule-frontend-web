# Tracking — Public API Documentation Site

**Feature**: Public API Documentation Site
**Plan**: [ai-plans/2026-07-16-PUBLIC_API_DOCS_IMPLEMENTATION_PLAN.md](2026-07-16-PUBLIC_API_DOCS_IMPLEMENTATION_PLAN.md)
**Started**: 2026-07-16
**Last updated**: 2026-07-16
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

## Current Phase

Phase 1 — Getting-started + auth guide (next).

## Remaining Phases

| Phase | Title | Tier | Notes |
| --- | --- | --- | --- |
| 1 | Getting-started + auth guide | 2 | Adds the syntax highlighter to a docs markdown pipeline (`rehype-highlight` per the plan's Open Questions default). Sanitize must stay in the chain. |
| 2 | GraphQL schema reference from live introspection | 3 | Build-time introspection with committed-snapshot fallback. Backend is not deployed, so the live fetch will fail and the snapshot path is what actually runs — see Deferred. |
| 3 | Concept guides fetched from backend | 3 | Depends on the Phase 2b endpoint, which is deferred. Snapshot fallback path is what will run. |
| 4 | Webhooks reference | 2 | Hand-authored enum of seven webhook event types. |
| 5 | Embedded GraphiQL explorer | 3 | Adds GraphiQL. Check its SPDX license before installing — the repo blocks GPL-2.0-only / GPL-3.0-only / AGPL-3.0-only / SSPL-1.0. |
| 6 | Wire landing-page links to `/docs` | 1 | Mechanical href edits in `marketing-home.tsx`. |

## Deferred Phases

### Phase 1b — Backend: allow docs origin + confirm introspection (cross-repo)

Lives in `~/Workspaces/vinta-schedule`, so this conductor does not implement it. Adds the docs origin to `CORS_ALLOWED_ORIGINS` and asserts introspection is reachable. **Must be deployed before** Phase 2's build introspects a live backend and before Phase 5's explorer makes real cross-origin calls. Neither phase is blocked from landing in-repo — both fall back to snapshots / work against a local dev backend.

### Phase 2b — Backend: concept-docs serving endpoint (cross-repo)

Lives in `~/Workspaces/vinta-schedule`. Serves `docs/concepts/*.md` over `GET /public-api-docs/` and `GET /public-api-docs/{slug}/`. **Must be deployed before** Phase 3's build fetches concept docs. Phase 3 can still land using its committed snapshot.

Both backend phases need separate PRs in that repo and are tracked there, not here.
