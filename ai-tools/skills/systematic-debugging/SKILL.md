---
name: systematic-debugging
description: Use when debugging any defect, test failure, regression, performance issue, or unexpected behavior in vinta-schedule-frontend-web (Next.js 16 App Router + React 19 + TypeScript strict; Tailwind v4 with tokens in the `vinta-schedule-design-system` pnpm-workspace package (shadcn/ui atoms + layout primitives); TanStack Query v5 over hey-api generated OpenAPI clients; react-hook-form + zod; Vitest + Testing Library; Playwright e2e; two Storybooks; deployed to Vercel via tag-driven CI). Enforces a root-cause-first investigation flow before any code change is proposed. Pulls evidence from the project's observability MCP tools (sentry) before forming a hypothesis. Cites the project's real test, lint, and type-check commands so reproduction steps are concrete.
---

# Systematic debugging

Random fixes mask root causes and grow new bugs on top of old ones. This skill drives debugging through four ordered phases. Each phase has an exit gate; you may not advance until the gate is satisfied.

## Iron law

> **No code change until the root cause is identified and named.**

A change that makes the symptom go away without an explanation of *why the symptom existed* is a guess, not a fix. Guesses do not ship.

## When to invoke

- Test failure (red unit, scoped, or e2e suite).
- Production incident or alert page.
- Unexpected behaviour reported by a user, QA, or another engineer.
- Performance regression (latency / throughput / memory).
- Build, type-check, lint, or deploy failure that is not obviously a typo.
- A previous fix did not work and you are tempted to "try one more thing".

The pressure to skip this skill is highest exactly when it is most needed. Treat "we don't have time for the process" as a signal to slow down, not speed up.

## Phase 0 — Observability sweep (MCP servers)

Before reading code, pull the evidence the platform already has. The project lists these observability MCP servers as available: **sentry**.

### Local-only escape hatch (per-run opt-out)

If the user passes `local-only` to this skill (e.g. `/systematic-debugging local-only — flaky test in test_foo.py`), or if the bug is obviously local — a unit test that has never run in CI, a build error on an unpushed branch, a typo — skip the entire MCP preflight + categories block. Open the Phase 0 evidence note with the line *"local-only debug at user request — no platform evidence consulted"* and continue to Phase 1. This bypass does **not** touch the cache.

If the user did not opt out, run the cached preflight below.

### Preflight — cached, with hard-stop on failure

State lives at `.vinta-ai-workflows/cache.yaml` (gitignored, schema [`mcp-preflight-cache.v1`](../../../../schemas/mcp-preflight-cache.v1.schema.json)). The cache has no TTL — `ok` entries stay valid until something proves them wrong. A failed MCP call later in this session flips the offending server to `dirty`, forcing a fresh preflight on the next debug run.

For every server in `sentry`:

1. **Read** the cache entry for the server.
2. **Cache hit (`status: ok`)** → log one line `cache hit: <server> (<tools_count> tools, verified <relative-time> ago)` and skip to "Discover the right calls" below for this server. No tool listing, no extra calls.
3. **Cache miss / `dirty` / `missing` / `auth-error` / `unreachable`** → run a fresh preflight:
   - Check that an MCP server with that identifier is connected. If not, **stop and tell the user verbatim**: *"systematic-debugging requires the `<name>` MCP server, but it is not connected in this session. Connect it, run with `local-only`, or remove it from `skills.systematic-debugging.observability_mcp_servers` in `.vinta-ai-workflows.yaml`."* Write `status: missing`, `error_message: "not connected"` to the cache and stop.
   - Confirm at least one tool from that server can be invoked. Auth error / expired token / missing API key → same hard-stop, with the upstream error message quoted verbatim. Cache as `status: auth-error`, `error_message: "<verbatim>"`.
   - On success: write `status: ok`, `verified_at: <now>`, `tools_count: <n>` to the cache.
4. Do **not** silently fall back to a different server, to local logs, or to "investigate without observability". A configured-but-broken server is a configuration bug; surface it. The user can choose to re-run with `local-only` once they see the failure.

If `sentry` is `none configured`, the cache is irrelevant — skip the preflight and use the no-tools fallback rendered below. Warn once if the bug appears production-only: *"This bug looks production-only and no observability MCP server is configured. Re-run with `local-only` to silence this warning, or wire up an observability MCP server first."*

### Mid-session invalidation (mark dirty)

Any later MCP call that fails with auth, connection, or transport error → patch the cache entry: `status: dirty`, `verified_at: <now>`, `error_message: "<verbatim>"`, optionally `marked_dirty_during: "<phase / plan / session id>"`. Continue the debug session using whatever evidence is already collected; do not re-preflight inside the same session. The next debug run will see `dirty` and re-preflight just that server.

A successful tool call against a server that's currently marked anything other than `ok` is allowed to flip it back to `ok` — the server clearly recovered.

### Refresh the cache manually

- Force re-preflight everywhere: delete `.vinta-ai-workflows/cache.yaml`.
- Force re-preflight one server: edit the entry's `status` to `dirty` (or any non-ok value).
- Forget a server entirely: remove it from `skills.systematic-debugging.observability_mcp_servers` in `.vinta-ai-workflows.yaml` — the cache entry then becomes inert (no preflight, no warnings).

### Discover the right calls at runtime

**Do not assume tool names from training data — they go stale.** For each cache-hit server (and each server that just passed a fresh preflight), list the tools it exposes, then map them to the evidence categories below by reading their descriptions and parameter names. If a server claims to cover a category but no listed tool matches, ask the user before falling back to "no evidence available".

The project configures these observability MCP servers: **sentry**. Discover the right calls inside them at runtime — the tool names below are never hardcoded.

### How to discover the right MCP calls

The cached preflight in the rendered SKILL.md decides which servers to introspect this run (cache-hit servers skip listing; freshly-preflighted servers get listed). For each server cleared by preflight, list every tool it exposes and group them by the evidence categories below — match on tool description and parameter names, not on remembered names from past sessions. MCP servers rename tools and add capabilities frequently; **trust the live tool list, not training data**.

If a server claims to cover a category but no listed tool matches the description, ask the user before falling back to "no evidence available" — the tool may exist under a name the matcher missed.

If a tool call fails mid-session with auth / connection / transport errors, mark the server `dirty` in `.vinta-ai-workflows/cache.yaml` so the next debug run re-runs preflight on it. Do not re-preflight inside the same session — keep moving with the evidence already gathered.

### Categories of evidence the skill requires

For each category: what evidence is needed, what to extract, and what shape of MCP tool typically provides it. Skip a category only when no configured server can supply it; record the skip in the Phase 0 evidence note (*"no metric source available"*).

#### 1. Error tracking — fingerprints, stack traces, occurrence counts

**Why:** identifies the exact failure signature, how many users / tenants / regions hit it, when it started.

**Look for tools that:** search or list errors / issues / events; fetch a single error's full payload (stack trace, breadcrumbs, request context, release tag, environment); group by fingerprint; resolve / mute / link an error.

**Extract into the evidence note:**
- The error's stable id and permalink.
- First-seen and last-seen timestamps in UTC.
- Affected scope: environment, release / build, tenant, route, user count.
- Correlated identifiers (trace id, request id, session id) so the next category can cross-reference.

#### 2. Distributed tracing — span chains, upstream / downstream calls

**Why:** shows the request path across services, which span actually failed, what was upstream of it.

**Look for tools that:** fetch a trace by id; query traces by service + time window; surface the slow / failing span in a trace; list dependencies of a service.

**Extract into the evidence note:**
- The failing span's name, service, and the parent chain leading to it.
- Whether the failure originates in our code or a downstream dependency.
- Latency on each span vs. its baseline (helps tell "slow downstream" from "broken downstream").

#### 3. Logs — raw lines around the incident window

**Why:** error tracking shows the exception, but logs show what the process did *before* and *after*.

**Look for tools that:** filter / search logs by time window + service + free-text or structured query; tail logs around a specific request id or trace id; list log streams for a resource.

**Extract into the evidence note:**
- The log lines before the error (what state the process was in).
- Log lines after the error (did the process recover, restart, crash?).
- Any other error or warning in the same window from the same service — often a precursor.

#### 4. Metrics — RED / USE / saturation signals

**Why:** confirms whether the bug is a one-off, a steady leak, or a step-change tied to a deploy.

**Look for tools that:** query a metric over a time range; list metrics for a service / resource; describe a dashboard or panel.

**Extract into the evidence note:**
- Error rate, request rate, p50 / p95 / p99 latency on the affected operation, around first-seen and over the prior equivalent window.
- Saturation signals where applicable: queue depth, CPU, memory, connection pool, db locks.
- Whether the anomaly is a spike, a step-change, or a slow drift.

#### 5. Alerts / monitors / SLO burn

**Why:** the platform may already have flagged the incident; if it didn't, the skill should leave a note for whoever maintains the alerts.

**Look for tools that:** list firing alerts in a window; describe an alert / monitor's current state; show SLO burn rate.

**Extract into the evidence note:**
- Any alert that fired or recovered in the incident window.
- Any alert that *should have* fired but didn't (gap in coverage to flag in the PR description).
- SLO burn rate if the affected operation has one.

#### 6. Deploys / releases / config changes

**Why:** "what changed" is usually the answer. The platform's deploy timeline beats `git log` because it shows what's actually running.

**Look for tools that:** list recent deploys for a project / service; describe a deploy's commit sha, author, and timestamp; list feature-flag flips; show config-store revisions.

**Extract into the evidence note:**
- The closest deploy / release / flag flip / config push before first-seen.
- Whether the incident first-seen aligns within minutes of that change.
- The commit sha or change id so the implementer can `git show` it during Phase 1.

#### 7. Dashboards — pre-built views the team already trusts

**Why:** SREs and product engineers have curated panels that the systematic-debugging agent should not try to recreate from scratch.

**Look for tools that:** search dashboards by title / tag; render a dashboard URL pinned to a time window; list panels in a dashboard.

**Extract into the evidence note:**
- URL of the most relevant dashboard, pinned to the incident window.
- The panel that visualises the anomaly (so the human reviewer can verify by eye).

### How to use the evidence

Once the categories above are filled in (or explicitly skipped), the Phase 0 evidence note is complete. Carry trace ids and request ids forward — the same id often unlocks deeper queries in a tool the agent already used. Do not move to Phase 1 until the cause's *blast radius and timeline* are written down: which scope is affected, when it started, what changed in the same window.

**Do not skip this phase because the bug "looks local".** A failing unit test on your machine and a 500 in production at the same hour is one incident, not two. The observability sweep is what reveals that.

## Phase 1 — Root cause investigation

Goal: state the cause in one sentence with a citation (file:line, log line, or trace span).

1. **Read the error completely.** Stack trace from bottom to top. Note every frame in our code — skip framework noise on the first pass, return to it only if our frames don't explain it.
2. **Reproduce locally.**
   - Unit / integration: `pnpm run test` — `pnpm run test` runs `vitest run` for the app plus `pnpm --filter vinta-schedule-design-system test` for the design system; scope with `pnpm vitest run <path-or-pattern>`, or `pnpm --filter vinta-schedule-design-system test` for design-system-only work
   - Single failing test in isolation: ``pnpm vitest run <new-test-path>``
   - Type / build gate: `pnpm run typecheck` — runs `tsc --noEmit` for the app **and** `pnpm --filter vinta-schedule-design-system typecheck` for the design-system package. (`pnpm run build` is the Vercel deploy build, **not** the per-phase gate.) **No CI job runs lint / typecheck / tests in this repo — the GitHub workflows only deploy. This local gate is the only gate**
   - Lint: `pnpm run lint`
   - E2E: Playwright, config at `playwright.config.ts` (testDir `e2e/tests`, chromium, baseURL from `E2E_BASE_URL`, default `http://localhost:3000`). **There is no `test:e2e` npm script** — invoke Playwright directly: `npx playwright test` (all), `npx playwright test <path>` (one spec), `npx playwright install chromium` (first run on a machine). Specs live at `e2e/tests/app/<ID>-<slug>.spec.ts` and map 1:1 to ids in [QA_USE_CASES.md](QA_USE_CASES.md) (`PR###` = member, `PA###` = admin). Tests hit a **live backend** — no mocking layer; they need `NEXT_PUBLIC_API_BASE_URL` + `E2E_MEMBER_ACCESS_TOKEN` / `E2E_ADMIN_ACCESS_TOKEN` to pass. Screenshots: specs call `basePage.screenshot('<id>', '<NN>', '<slug>')`; `node e2e/scripts/collect-screenshots.mjs` copies them into `pr-screenshots/` (gitignored). See [add-e2e-test](../add-e2e-test/SKILL.md) + [e2e/README.md](e2e/README.md).
   If you cannot reproduce, gather more evidence (Phase 0 logs, traces, user repro steps). Do not propose a fix against a bug you cannot trigger.
3. **Bisect recent changes.** `git log --oneline main..HEAD` plus `git log -p` on the suspect file. Check the deploy timeline from Phase 0 against commits.
4. **Trace data flow at component boundaries.** For every layer the bad value crosses (request → handler → service → store → response), log the value entering and the value leaving. Find the layer where the value changes shape unexpectedly. That layer holds the bug.
5. **Trace backward from the failure.** If the error is "got `undefined`", the question is not "why did this consumer crash" but "who produced `undefined` and why was that allowed to propagate".

Exit gate: write the cause as a single sentence — *"`OrderService.applyDiscount` returns `null` when the cart has zero items because the early-return at orders.ts:142 predates the empty-cart feature, and the caller at checkout.ts:88 forgot to handle null."* Vague causes ("something with discounts") fail this gate.

## Phase 2 — Pattern analysis

Goal: confirm the root cause by comparing against working code.

1. Find a sibling code path that does the *same kind of thing* and works. (Another service method, another handler, another reducer.)
2. Diff the working path against the broken one. Note every difference, even ones that "couldn't matter".
3. If the bug is in a library / framework integration, read the upstream reference implementation or docs end-to-end before continuing. Skim is not allowed.
4. List dependencies the broken path silently relies on (env var, feature flag, migration, cache warm-up). Verify each one is present in the failing environment.

Exit gate: you can name what the broken path is missing or doing differently, and show the working path as proof.

## Phase 3 — Hypothesis & test

Goal: a single hypothesis, a single failing test, no speculative changes.

1. State the hypothesis: *"If I change X to Y, the bug stops because Z."*
2. Write the failing test FIRST.
   - New test file: ``pnpm vitest run <new-test-path>``
   - Scoped suite: ``pnpm vitest run <path-or-pattern>` (app), `pnpm --filter vinta-schedule-design-system test` (design system)`
   - The test must fail today for the same reason production fails. A test that fails for a different reason is a different bug.
3. Make the smallest possible change. One variable. No drive-by refactors. No "while I'm here".
4. Re-run the failing test. Did it go green? Re-run the scoped suite — did anything else go red?
5. If the test stays red, do **not** stack a second change on top. Return to Phase 1 with the new evidence (the test plus what it shows) and re-state the cause.

Exit gate: one new test, red before the change, green after, no other test newly red.

## Phase 4 — Implementation & verification

Goal: ship the fix at the right level of abstraction with the right safety net.

1. **Fix at the source, not the symptom.** If null leaks from a producer, fix the producer. Defensive null-checks at the consumer are an additional layer (see "defense in depth" below), not a replacement for the source fix.
2. **Defense in depth where the cost is low.** Validation at the boundary, an assertion in the producer, a typed return that forbids the bad shape — pick the layer the codebase already invests in. Don't sprinkle.
3. **Run the full local gate before pushing.**
   - `pnpm run lint`
   - `pnpm run typecheck`
   - `pnpm run test` — `pnpm run test` runs `vitest run` for the app plus `pnpm --filter vinta-schedule-design-system test` for the design system; scope with `pnpm vitest run <path-or-pattern>`, or `pnpm --filter vinta-schedule-design-system test` for design-system-only work
      c. **E2E** (opt-in): {If `run_options.run_e2e = true`:} when this phase has an e2e spec, run `npx playwright test e2e/tests/app/<ID>-<slug>.spec.ts` and then copy screenshots into `pr-screenshots/` via `node e2e/scripts/collect-screenshots.mjs`. {Else:} skip e2e this run (default — e2e boots a browser against a live backend and makes the phase take a lot longer).
4. **Route the fix diff through the shared review gate.** Invoke [review-phase](../review-phase/SKILL.md) — the same three-layer review (mechanical checks, plan/intent-compliance walkthrough, independent reviewer subagent) + fix loop that [implement-plan](../implement-plan/SKILL.md) and [amend-plan](../amend-plan/SKILL.md) use — passing the fix diff, the one-sentence root cause + the new failing-then-passing test as the "body" to walk against, and `WORKROOT` = the current checkout. A bug fix is not done until review-phase returns clean. (When this skill runs *inside* implement-plan's inner/outer loop, the enclosing phase's review-phase already covers this — don't double-review; the standalone invocation is for bugs debugged outside a plan.)
5. **Verify on the observability side after deploy.** The error fingerprint from Phase 0 should stop firing. If the platform supports it, mark the issue resolved in the source MCP tool so a regression re-opens it instead of creating a duplicate.
6. **Document if the fix is non-obvious.** A comment is justified only when the *why* would surprise the next reader — a hidden invariant, a workaround for a known upstream bug, a constraint not visible from the call site. Don't narrate the change.

## Stop conditions — count your attempts

If you reach **three failed fix attempts** on the same bug, the architecture is suspect, not the next line you were about to change. Stop and escalate:

- Re-read the original report. Has the symptom drifted as you patched things?
- Are the three attempts each fixing a different file? That is a sign the contract between layers is wrong, not any single layer.
- Bring a second engineer (human or another agent) to walk Phase 1 from scratch. Don't hand them your hypothesis — hand them the symptom.

A fourth attempt without architectural review is how week-long debugging sessions start.

## Red flags — return to Phase 1 immediately

You catch yourself thinking or typing any of:

- "Quick fix now, investigate later."
- "Let me try changing X and see if it works."
- "It's probably the cache / the build / a flaky test."
- "I don't fully understand this but this might work."
- "I'll add a try/catch around it."
- "I'll skip writing the test, the manual repro is enough."
- "Let me bundle this fix with the cleanup I was going to do anyway."

These are not debugging — they are guessing with extra steps. Stop and re-enter Phase 1.

## Reusable skills the orchestrator should chain

When this skill runs inside [implement-plan](../implement-plan/SKILL.md) (the inner / outer test loop), the implementer agent invokes systematic-debugging on every red gate and reports the Phase-1 cause in its report. The orchestrator never overrides the Iron Law — a phase that can't name the cause is not allowed to land.

For the review gate in Phase 4, this skill shares [review-phase](../review-phase/SKILL.md) with implement-plan and amend-plan — one review implementation across all three, so a bug fix meets the same three-layer bar as any planned phase.

For new test scaffolding, defer to the project's test conventions captured in [AGENTS.md](../../AGENTS.md). For env / config issues uncovered in Phase 0, route to the project's `add-env-var` skill if shipped (`plan-feature, create-spec, create-qa-use-cases, implement-plan, implement-phase, review-phase, integrate-phase-stacked, integrate-phase-modular, amend-plan, open-pr-from-context, prepare-worktree, systematic-debugging, thermo-nuclear-code-quality-review, deslop-comments, handoff, add-e2e-test, add-env-var, new-page, new-composition, new-component, new-hook, add-storybook-story`).

## Verification checklist (apply before claiming a bug fixed)

1. Phase 0 evidence stored or linked in the PR description (trace id / issue link / dashboard URL).
2. Root cause stated in one sentence in the PR description.
3. New failing-then-passing test cited by file:line.
4. Full local gate green: `pnpm run lint` + `pnpm run typecheck` + `pnpm run test` + the e2e suite when `run_options.run_e2e = true`.
5. [review-phase](../review-phase/SKILL.md) run on the fix diff and returned clean (unless the fix landed inside an implement-plan phase already covered by its review-phase).
6. Observability source updated post-deploy (issue resolved / alert acknowledged) so a recurrence pages instead of silently re-opening.
