# Worktree: plan-billing-plans-and-limits-frontend

Branch: `plan/billing-plans-and-limits-frontend/wt` (based on `origin/main`).

## What's forked vs shared
- Deps: node_modules symlinked to the main checkout (Phase 6 pnpm add updates the worktree's own package.json + lockfile).
- Env: `.env` copied from main; `.env.example` tracked.
- DB / compose: none in this repo.

## Write protection
Sandbox tier: `none`. No OS guard is active for this run; the orchestrator's post-run
`git -C <main> status` stray-write check is the backstop.

## How to run things
- Typecheck: `pnpm run typecheck`
- Tests: `pnpm run test` (scope with `pnpm vitest run <path>`)
- Lint: `pnpm run lint`

## Teardown
  git worktree remove /Users/hugobessa/Workspaces/vinta-schedule-frontend-web/.claude/worktrees/plan-billing-plans-and-limits-frontend
  rm /Users/hugobessa/Workspaces/vinta-schedule-frontend-web/.vinta-ai-workflows/worktrees/plan-billing-plans-and-limits-frontend.yaml
