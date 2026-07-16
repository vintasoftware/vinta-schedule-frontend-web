# ai-tools/agents

Canonical, vendor-agnostic sub-agent definitions for this project. One YAML per agent.

`setup-ai-tools.mjs` reads these and emits per-vendor copies (Claude `.claude/agents/*.md`,
and Cursor / Copilot / Codex variants if those vendors are enabled in
`.vinta-ai-workflows.yaml`). **Edit the YAML here, never the generated vendor files** — vendor
files are overwritten on every setup run.

Schema: [`sub-agent.v1.schema.json`](../../node_modules/vinta-ai-workflows/schemas/sub-agent.v1.schema.json).
Each file starts with a `yaml-language-server` comment so editors validate against it live.

## Agents in this project

| Agent         | Access       | Role                                                                |
| ------------- | ------------ | ------------------------------------------------------------------- |
| `implementer` | `read-write` | Executes one phase of an `ai-plans/` plan. Inner loop + outer gate. |
| `reviewer`    | `read-only`  | Adversarial review of one phase diff. BLOCKER / SHOULD-FIX / NIT.   |
| `fixer`       | `read-write` | Applies one reviewer finding or one named gate failure.             |

No stack specialists. The matched stacks (`nextjs-app-router`, `typescript-monorepo`) have no
work that splits cleanly away from the implementer — Vercel handles deploys, and there are no
migrations. Add one only when a real division of labor appears.

## Schema

```yaml
# yaml-language-server: $schema=./node_modules/vinta-ai-workflows/schemas/sub-agent.v1.schema.json
schema_version: 1 # required, always 1
name: <kebab-case> # required, must match the filename stem
description:
  <text> # required; one-line role + when-to-use. Feeds vendor
  # frontmatter and drives delegation hints.
access:
  read-only | read-write # required; drives vendor defaults (Claude `tools:`,
  # Cursor `readonly:`, Codex `sandbox_mode`, Copilot `tools[]`)
body: | # required; markdown agent prompt as a YAML literal block
  # Agent Name
  ...
```

Optional fields:

| Field           | Purpose                                                                  |
| --------------- | ------------------------------------------------------------------------ |
| `claude-tools`  | Comma-separated Claude tool list; overrides the default from `access`.   |
| `model`         | Default model preference. See "Models" below — usually leave this unset. |
| `is_background` | Cursor-only; run the agent as a background task.                         |
| `overrides`     | Per-vendor escape hatch: `claude`, `cursor`, `copilot`, `codex`.         |

```yaml
overrides:
  claude: { tools: 'Read, Grep, Glob', model: opus }
  cursor: { model: ..., readonly: true, is_background: false }
  copilot: { tools: [codebase, editFiles], model: ..., user-invocable: true }
  codex: { sandbox_mode: read-only, model_reasoning_effort: high }
```

`access` alone covers the common case — reach for `overrides` only when one vendor genuinely
needs to differ.

## Models

**Don't hard-code a model in these YAMLs.** Model selection lives in
`.vinta-ai-workflows.yaml` under `agent_models`, expressed as **tiers** (1–4) into
`ai-tools/skills/plan-feature/resources/ai-models.yaml`. The spawning skill resolves a tier to
a concrete model at runtime: take the tier's models, filter to vendors the runtime exposes,
pick the cheapest survivor. That keeps stale model IDs out of the repo.

Current project defaults: `reviewer: 3`, `fixer: 2`. A plan phase's `**Review models**:` line
overrides these for that phase; the implementer's model comes from each phase's
`**Suggested AI model**:` line.

## Conventions every agent body here follows

- **Real commands only.** `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`,
  `pnpm vitest run <path>`, `pnpm run format`, `npx playwright test`. Never invent a script —
  check `package.json` first. (There is no `test:e2e` script.)
- **Real conventions only.** `AGENTS.md` and `DESIGN.md` are the sources; agent bodies repeat
  the load-bearing rules inline so the agent has them without re-fetching.
- **No agent creates branches, pushes, or opens PRs.** The orchestrator owns git remotes.
- **No `Co-Authored-By` AI trailers.** Repeated in every read-write body.
- **Never `git add -A`.** The tree carries untracked `.env*`, generated `schema*.yml`, and
  regenerated client output.
- **No `§N` section shorthand.** Reference plan sections by full name
  (`Goals + Non-goals`, `Guiding Decisions`).

## Adding an agent

1. Write `ai-tools/agents/<new-name>.yaml` against the schema above.
2. Run `pnpm setup:ai-tools` (or `node ai-tools/scripts/setup-ai-tools.mjs`) to materialize
   the vendor copies.
3. Commit the YAML **and** the generated vendor files, staging explicit paths.
