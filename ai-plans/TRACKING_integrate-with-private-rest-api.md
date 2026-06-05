# Tracking — Integrate with private REST API

- **Plan**: [2026-06-05-INTEGRATE_WITH_PRIVATE_REST_API_IMPLEMENTATION_PLAN.md](2026-06-05-INTEGRATE_WITH_PRIVATE_REST_API_IMPLEMENTATION_PLAN.md)
- **Started**: 2026-06-05
- **Last updated**: 2026-06-05
- **Feature flag**: none (additive surface)
- **Branch pattern**: `plan/integrate-with-private-rest-api/phase-{id}`, stacked
- **run_options**: `pause_between_phases: false` (auto-flow), `generate_inline_comments: true`, `scope: all 44 executable phases`

## Baseline

- Backend shipped all endpoints; `schema.yml` updated, `src/client/` regenerated.
- Plan amended 2026-06-05: MSW mock layer dropped; **Phase 0b** and **Phase 39** superseded (retired ids).
- Baseline commit `7a6f817` on `phase-0a` branch (plan + schema + client regen + gitignore).

## Completed Phases

_None yet._

## Current Phase

- **Phase 0a — App shell, routing & role gating** (Tier 3, `claude-sonnet-4-6`) — in progress.

## Remaining Phases

0a, 0c, 0d, 0e, 0f (foundation); 1–38 (use-cases).

## Deferred / Superseded

- **Phase 0b** — MSW mock layer — superseded (live API).
- **Phase 39** — mock→live swap — superseded (live API).
- No cross-repo phases. No flag-removal phase (no feature flag).
