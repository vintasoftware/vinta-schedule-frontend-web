---
name: implement-phase
description: Internal execution step of [implement-plan] / [amend-plan] — NOT a standalone entry point. Given one already-classified plan phase plus the resolved `WORKROOT` / `BASE_BRANCH` / `SANDBOX_TIER`, it composes a token-efficient implementer prompt, picks the model from the phase's own suggestion, and spawns exactly one implementer subagent, returning that agent's report. Do not invoke directly for ad-hoc edits or in response to a user's raw feature request; the conductor invokes it once per executable phase in vinta-schedule-frontend-web.
---

# Implement one phase

Execution unit invoked by [implement-plan](../implement-plan/SKILL.md) (and by [amend-plan](../amend-plan/SKILL.md) for `amend-existing` rewrites). One phase in → one implementer report out. This skill does **not** review, branch, push, or open PRs — those are [review-phase](../review-phase/SKILL.md) and the resolved integrate-phase variant ([integrate-phase-stacked](../integrate-phase-stacked/SKILL.md) / [integrate-phase-modular](../integrate-phase-modular/SKILL.md)). It also does **not** decide whether a phase runs — the conductor already filtered cross-repo / flag-removal phases.

## Inputs (passed by the conductor as data — this skill re-derives none of them)

- `phase` record: `{ id, title, goal, body, spec_use_case, suggested_model_tier, reusable_skills, has_e2e, acceptance }`.
- Plan-level decisions: **Goals + Non-goals**, **Guiding Decisions**, the relevant **Data Model Changes** subsection.
- Prior-phase summaries (the tracking file's "Completed Phases" section).
- `WORKROOT`, `BASE_BRANCH`, `SANDBOX_TIER` — resolved once by the conductor ([Resolve WORKROOT step](../implement-plan/SKILL.md#step-05--resolve-workroot)).
- `run_options.full_test_suite` — resolves the outer gate's test scope in the composed prompt's `{If run_options.full_test_suite = true:}` marker (false = scoped suite only; true = full repo suite).

## 1. Compose the agent prompt (token-efficient)

Compose with **only what the agent needs**:

```
You are implementing {phase.id}: {phase.title} of plan {plan.id}.

## Repo
vinta-schedule-frontend-web (Next.js 16 App Router + React 19 + TypeScript strict; Tailwind v4 with tokens in the `vinta-schedule-design-system` pnpm-workspace package (shadcn/ui atoms + layout primitives); TanStack Query v5 over hey-api generated OpenAPI clients; react-hook-form + zod; Vitest + Testing Library; Playwright e2e; two Storybooks; deployed to Vercel via tag-driven CI).

## Working location
Work entirely inside `<WORKROOT>`. `cd` into it before any command. Every `git`,
every lint / test / build / migrate call runs there.
{If run_options.use_worktree = true:}
  `<WORKROOT>` is an isolated git worktree — do NOT touch the main checkout; its DB,
  env, and compose stack are intentionally separated. See `<WORKROOT>/WORKTREE.md` for
  what's forked vs shared (deps, dev DB, test DB, compose project name, env file).
  {If run_options.sandbox_tier = enforced:} Writes to the main checkout are OS-blocked —
  if you see `Operation not permitted` / `EROFS` on a write, you used a main-checkout
  path by mistake; redo it against this worktree path.
Branch base for this phase: `<phase-specific base>` — the orchestrator already created
your phase branch there; commit straight to it.

## Read first
1. AGENTS.md — repo conventions.
2. ai-plans/{plan-filename}, the **Goals + Non-goals**, **Guiding Decisions**, **Data Model Changes** sections and YOUR phase body inside **Phased Rollout**.
{If run_options.use_worktree = true:} 3. `WORKTREE.md` at the worktree root — fork map (which dirs symlink to main vs are independent copies).

## Plan-level decisions (from Goals + Non-goals + Guiding Decisions)
{Goals + Non-goals verbatim}
{Guiding Decisions table verbatim}
{If feature flag declared:}
  Feature flag: `{flag-key}` — scope `{per-tenant|per-request}`, default `{false|true}`.
  Wire reads + writes per the plan's **Guiding Decisions** entry. Off-flag path = byte-for-byte pre-feature behavior.

## What was already implemented in prior phases
{Tracking file "Completed Phases" section. First executed phase: "Nothing yet — this is the first phase."}

## Your tasks (Phase {id} only)
{phase.body verbatim, including Goal / Spec use-case / Feature flag / Changes / Tests / Acceptance lines}

## Reusable skills you SHOULD invoke
{phase.reusable_skills — for each, instruct the agent to first read ai-tools/skills/{name}/SKILL.md, then follow that pattern.}

Project skills available: plan-feature, create-spec, create-qa-use-cases, implement-plan, implement-phase, review-phase, integrate-phase-stacked, integrate-phase-modular, amend-plan, open-pr-from-context, prepare-worktree, systematic-debugging, thermo-nuclear-code-quality-review, deslop-comments, handoff, add-e2e-test, add-env-var, new-page, new-composition, new-component, new-hook, add-storybook-story

## Adding new third-party dependencies

Before running any install command (`pnpm add`, `npm add`, `yarn add`, equivalents), check the package's SPDX license against the project's forbidden list — see the **Dependency licenses** section in [AGENTS.md](AGENTS.md) for the full list, the per-package overrides, and any project-specific notes. Enforcement mode for this project is **block**. Forbidden: `GPL-2.0-only`, `GPL-3.0-only`, `AGPL-3.0-only`, `SSPL-1.0`.

Quick lookup:

- **npm / pnpm / yarn**: `npm view <pkg> license`.
- No license field / a bare `LICENSE` file with no SPDX id → treat as unknown; see below.

If the license is in the forbidden list AND the `(package, license)` pair is **not** listed under **Approved overrides** in AGENTS.md:

1. Stop. Do not run the install command.
2. Surface the violation to the user with: package name, SPDX identifier, why it's forbidden, link to the upstream license.
3. Offer alternatives (search the ecosystem for an MIT / Apache-2.0 / BSD-licensed equivalent) before asking for an override.
4. If the user grants a one-off override, the orchestrator must record it in `policies.dependency_licenses.allowed_overrides[]` of `.vinta-ai-workflows.yaml` (package + SPDX + one-line reason) before re-running the install. Undocumented overrides leak into the diff and the reviewer agent will flag them.

**License unknown / undeclared.** When the lookup above returns no license, an empty value, `UNKNOWN`, `SEE LICENSE IN <file>`, or only an unstructured `LICENSE` file in the repo with no SPDX identifier, treat it as a **policy decision the user owns** — don't guess, don't auto-infer, don't fall back to "assume MIT". The package may be unlicensed (all-rights-reserved by default in most jurisdictions), proprietary, or simply missing metadata.

1. Stop. Do not run the install command.
2. Surface to the user: package name, what was found (e.g. "the `license` field is absent in `package.json`", "no LICENSE file in the repo"), the upstream repo / registry URL so the user can verify.
3. Ask via `AskUserQuestion`: `Skip — find a licensed alternative`, `Treat as forbidden — refuse install`, `Treat as allowed — record an override` (the third option only when the user has independently confirmed the license off-channel; record the resolved SPDX in `allowed_overrides[]` with the source in the `reason` field).
4. Don't add the dep until the user picks one of the three.

Transitive deps follow the same rule, but checking every transitive license at install time is impractical — a separate license-audit run handles the deep walk. **Note: no CI job audits licenses in this repo**, so the direct add you are about to make is the only checkpoint. The subagent's responsibility is the **direct** add.

## Working instructions
1. Read existing code paths your changes touch — do not write before reading.
2. Implement using Read/Edit/Write. Match existing patterns.
3. **Inner loop — fast iteration.** Scoped to files/apps you touched:
   a. `pnpm run lint` until clean.
   b. `pnpm vitest run <new-test-path>` for new tests individually.
   c. Scoped suite: `pnpm vitest run <path-or-pattern>` (app), `pnpm --filter vinta-schedule-design-system test` (design system).
4. Iterate 2–3 until **new tests pass individually** and the scoped suite is green. Do **not** advance to step 5 with red scoped tests.
5. **Outer gate — local verification, only after step 4 is green.** All MUST pass before staging:
   a. **Type / build:** `pnpm run typecheck` — repo-wide, always.
   b. **Tests:** by default run only the **scoped suite** ``pnpm vitest run <path-or-pattern>` (app), `pnpm --filter vinta-schedule-design-system test` (design system)` for the apps/files you touched — the new tests already passed individually in step 4b, so this re-confirms the touched surface without paying for the whole repo.
      {If run_options.full_test_suite = true:} run the **full test suite** `pnpm run test` instead of the scoped suite — this phase guards against regressions in untouched code too.
      c. **E2E** (opt-in): {If `run_options.run_e2e = true`:} when this phase has an e2e spec, run `npx playwright test e2e/tests/app/<ID>-<slug>.spec.ts` and then copy screenshots into `pr-screenshots/` via `node e2e/scripts/collect-screenshots.mjs`. {Else:} skip e2e this run (default — e2e boots a browser against a live backend and makes the phase take a lot longer).
6. Outer gate fails → return step 2 (fix regression), re-run inner loop, then 5a/5b/5c. **Never** commit, push, or proceed while any gate is red.
{If `run_options.commit_strategy_resolved = "modular-commits"`:}

7. **Plan commit units before staging.** List the logical units this phase produces (e.g. `3 services + 1 use case update + 1 init export`). Each unit = **one** commit. Tests for that unit travel **in the same commit** as the code they test — never a separate commit.
8. For each unit, in order:
   a. Stage exactly that unit's files: `git add <explicit paths>` (NEVER `git add -A` — the tree carries untracked `.env*` files, generated `schema.yml` / `schema-auth.yml` synced from the backend repo, and regenerated `src/client/` + `src/auth-client/` output; `git add -A` sweeps secrets and codegen churn into the commit). Tests for the unit go in the same `git add`.
   b. Commit with the repo's commit_style — see the **Commit Boundaries** + **Commit Message Format** tables below.
   c. Don't bundle two units in one commit. If the commit message needs the word "and" to cover the diff, **split** — see **Red Flags** below.
9. **Do NOT add any AI co-author trailer.** No `Co-Authored-By: Claude`, no `Generated with …` line, no AI attribution of any kind in the commit message.
10. **Do NOT push and do NOT open a PR.** The orchestrator owns the remote — it pushes your branch and opens the PR after review passes. — push all unit commits at once at end of phase.

### Modular-commits discipline (load-bearing — re-read every phase)

Commit each logical unit independently as you complete it. One service = one commit. One use-case update = one commit. Tests travel with the code they test.

The commit list becomes a **table of contents** for reviewers — they can read the commit titles before touching any code and already understand the shape and sequence of the implementation.

#### Commit Boundaries

| Unit | When to commit | Example commit message |
|------|---------------|------------------------|
| New service | Service + its unit tests complete | `feat(team): add useTeamInvitations query hook` |
| Use case update | Use case wires in new services, with integration tests | `feat(team): wire invitations datatable into the team page` |
| Init / exports | After exposing new symbols | `chore(design-system): expose new primitives from the package barrel` |
| Serializer field | Field + validation + tests | `feat(team): add role field to the invite form schema` |
| Refactor / cleanup | Standalone cleanup pass only | `refactor(team): reuse the shared DataTable column factory` |
| Bug fix | Fix + regression test | `fix(calendars): include disabled calendars in the picker list` |

Tests for a unit belong **in the same commit** as that unit. Never commit tests separately.

#### Commit Message Format

Spec: [conventionalcommits.org](https://www.conventionalcommits.org/en/v1.0.0/)

```
<type>(<scope>): <description>

[optional body: non-obvious why, constraints, or side effects — omit if obvious]
```

| Type | Use for |
|------|---------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `chore` | Maintenance — barrel exports, config, generated-client refresh |
| `docs` | Documentation only |
| `test` | Tests only |

**Scope:** the feature area or module (e.g. `team`, `calendars`, `auth`, `design-system`). Optional but recommended.

**Breaking changes:** append `!` before the colon — `feat(auth)!: replace session tokens`.

```
feat(team): add useTeamInvitations query hook
feat(team): add invitations datatable composition
feat(team): wire invitations datatable into the team page
chore(design-system): expose new primitives from the package barrel
refactor(team): reuse the shared DataTable column factory
```

Bad:

```
WIP
add stuff
Implement full team management feature   ← too broad, should be split
```

#### Red Flags — Split the Commit

- Commit message needs "and" to cover everything in it.
- You are staging files from two different units.
- A reviewer cannot understand the diff without seeing the other commits first.

#### Common Rationalizations

| Rationalization | Reality |
|----------------|---------|
| "I'll commit everything at the end" | Reviewers read commit-by-commit; one giant diff hides intent. |
| "The user can squash later" | Squashing destroys the logical history this discipline exists to preserve. |
| "It's faster to do one commit" | Planning units takes 2 minutes; reviewing a 2000-line blob takes much longer. |
| "The changes are all related" | Related ≠ same unit. Services that depend on each other still get separate commits. |

{Else (`stacked-branches`):}

7. Stage the right files (NEVER `git add -A` — the tree carries untracked `.env*` files, generated `schema.yml` / `schema-auth.yml` synced from the backend repo, and regenerated `src/client/` + `src/auth-client/` output; `git add -A` sweeps secrets and codegen churn into the commit). Stage explicitly: `git add <explicit paths this phase touched — e.g. `src/... packages/design-system/src/... e2e/... ai-plans/...`>`.
8. Commit with the repo's style — look at `git log -10 --oneline` first. This repo uses **Conventional Commits**: `type(scope): subject` — e.g. `feat(team): add invitations datatable`, `fix(auth): refresh token before retry`, `chore(client): regenerate hey-api output`. Types in use: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`.
9. **Do NOT add any AI co-author trailer.** No `Co-Authored-By: Claude`, no `Generated with …` line, no AI attribution of any kind in the commit message.
10. **Do NOT push and do NOT open a PR.** The orchestrator owns the remote — it pushes your branch and opens the PR after review passes.

## Required output (single final report)
- Status: SUCCESS or FAILURE (and why).
- Files created/modified (paths only).
- 5–15 line summary of what you implemented and key decisions.
- E2E: specs run + screenshot paths, or "skipped (run_options.run_e2e = false)".
- Deviations from the plan body and reasoning.
- Anything you couldn't do (with explanation).
```

**Don't** dump the full plan into every prompt. Tracking summaries replace prior phases as context. Always include the **Goals + Non-goals** and **Guiding Decisions** sections plus the relevant **Data Model Changes** subsection — load-bearing decisions; phases reach back frequently.

## Pick the model from the plan's per-phase suggestion

**The plan owns the *implementer* model — this skill does not re-derive tiers and doesn't assume a vendor.** Each phase carries a `**Suggested AI model**:` line listing one model per vendor. (The reviewer / fixer models default to `.vinta-ai-workflows.yaml`'s `agent_models` section, though a phase's optional `**Review models**:` line can override them for that phase; the mechanical-step models are `agent_models`-only. All of that is handled by `review-phase` / the conductor, not this implementer step.)

Pick:

1. Read the line, parse out **all** vendor suggestions.
2. **Filter to what's actually available in the runtime.** Different harnesses expose different sets.
3. From the surviving suggestions, **pick the cheapest / fastest** the runner can use.
4. Translate the chosen model to whatever form the runner's spawning tool expects.
5. Phase suggestion straddles tiers → pick the higher-tier suggestion.
6. Line missing / malformed → **ask the user**. Don't silently re-derive tier.

**Retry escalation (no user prompt):** the picked model fails on a clear capability gap → step **one tier up** and retry once. After Tier 4 fails, STOP. Update tracking with `❌`, post the agent's report to the user, ask how to proceed.

Record the **model actually used** + the **plan's suggested tier** in tracking.

## 3. Spawn the subagent

Use whatever agent-spawning primitive the runtime exposes. Pass:

- A descriptive label (e.g. `"{plan.id} {phase.id}: {phase.title}"`).
- The model from the [Pick the model](#pick-the-model-from-the-plans-per-phase-suggestion) step, translated to the runner's form.
- The phase prompt from the [Compose the agent prompt](#1-compose-the-agent-prompt-token-efficient) step.
- The right **agent type** (below).

**Sandbox the spawn — only when `SANDBOX_TIER = enforced`.** The prompt tells the subagent to stay in `WORKROOT`, but that's cooperative — a smaller model can resolve a path back to the main checkout and silently write there (the review-phase stray-write check catches this reactively). When `SANDBOX_TIER = enforced` **and** the runtime spawns subagents as **subprocesses** (it shells out to an agent CLI — e.g. `codex exec …`, a `claude -p …` child, a custom runner), wrap that launch command in the worktree's bundled guard so the OS blocks main-checkout writes regardless of harness:

```bash
ai-tools/skills/prepare-worktree/scripts/sandbox-run.sh \
  --deny  <main_checkout> \
  --allow <WORKROOT> \
  --allow <main_checkout>/.vinta-ai-workflows \
  --allow <main_checkout>/.git \
  -- <the agent spawn command>
```

`<main_checkout>` is the repo root the skill was invoked from (never `WORKROOT` when a worktree is in use). A stray write then fails with `Operation not permitted` / `EROFS`; the subagent retries against the worktree. `<main_checkout>/.git` must be allowed because git worktrees write commits into the main repo's `.git` (shared objects/refs, `.git/worktrees/<name>/index.lock`); omitting it makes the subagent's own `git commit` fail.

- **In-process subagent runtimes** (orchestrator and subagent share one OS process — e.g. claude-code's Task tool) can't wrap a single spawn. Two options: (a) install a runtime pre-write guard hook scoped to `WORKROOT` (prepare-worktree ships `scripts/claude-worktree-write-guard.py` + `scripts/gen-claude-sandbox-settings.sh` for claude-code); or (b) run the **entire** invocation under `sandbox-run.sh` with the same `--deny` / `--allow` set. Pick whichever the runtime supports.
- **`SANDBOX_TIER = none`** (no sandbox tool, or `use_worktree = false`) → skip wrapping; prevention falls back entirely to the review-phase stray-write check. Surface this once to the user when a worktree run is unsandboxed so the weaker guarantee is explicit.

**Agent type per phase.** Project agents in [`ai-tools/agents/`](ai-tools/agents/) (exposed to claude-code via `.claude/agents` symlink):

| Phase shape | Agent type | Why |
|---|---|---|
| Anything that writes code — routes under `src/app/`, feature compositions under `src/components/`, data hooks under `src/hooks/`, design-system atoms / primitives under `packages/design-system/src/`, Vitest tests, Storybook stories, Playwright specs, config, docs | `implementer` ([ai-tools/agents/implementer.yaml](ai-tools/agents/implementer.yaml)) | The only code-authoring agent this project ships. It reads AGENTS.md + DESIGN.md, executes the phase's Changes / Tests / Acceptance, runs the inner loop + outer gate, and reports. Never branches, pushes, or opens PRs. |
| Reviewing a phase diff (Layer 3) | `reviewer` ([ai-tools/agents/reviewer.yaml](ai-tools/agents/reviewer.yaml)) | Read-only adversarial review. Spawned by [review-phase](../review-phase/SKILL.md), never by this skill directly. |
| Applying one reviewer finding, or fixing one named gate failure | `fixer` ([ai-tools/agents/fixer.yaml](ai-tools/agents/fixer.yaml)) | Smallest correct change + re-run the gates. Spawned by [review-phase](../review-phase/SKILL.md)'s fix loop. |

**This project ships no stack-specialist agents** (`stack_specialist_agents: []`). Every executable phase — regardless of whether it is a route, a design-system primitive, a generated-client refresh, or an e2e spec — dispatches to `implementer`. Phase-specific expertise is carried by the **reusable skills named in the phase body** (`new-page`, `new-composition`, `new-component`, `new-hook`, `add-storybook-story`, `add-e2e-test`, `add-env-var`), not by swapping the agent type.

A phase that combines shapes → the agent type stays `implementer`, and the prompt lists every relevant SKILL.md. The agent type changes only when a stack-specialist's risk is the primary one.

**Avoid bouncing the same phase between multiple agents.** Wanting to "hand off" mid-phase → the plan should have split into sub-phases instead.

## Output

Return the implementer's single final report verbatim to the conductor (status, files, summary, deviations, blockers). The conductor — not this skill — writes tracking from the git diff + the report.
