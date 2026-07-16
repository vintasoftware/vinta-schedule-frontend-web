---
name: add-env-var
description: Introduce a new environment variable in vinta-schedule-frontend-web and propagate it through every layer that must know about it — `.env.example`, the reader module, the `NEXT_PUBLIC_` decision, Vercel's environment settings, the deploy workflow, `playwright.config.ts`'s webServer env forwarding, and the AGENTS.md env section. Use when the user says "add an env var", "make X configurable", "read Y from the environment", "add a feature flag via env", or when a plan phase introduces a new config value. NOT for changing an existing var's value (that's a Vercel dashboard / local `.env` edit, no code change).
---

# Add an environment variable

A new env var in this repo is never one file. Miss a layer and the failure is silent and late: it works locally, builds green, then the value is `undefined` in a Vercel preview or in the e2e dev server.

The propagation flow is short but non-obvious, because this app reads env vars in **four different execution contexts** (browser bundle, Next.js server runtime, `openapi-ts` codegen, Playwright's spawned dev server) and each context gets its values from a different place.

## Decision questions

Answer all four **before** editing anything.

### 1. Does it need to reach the browser?

This is the decision everything else hangs off.

| Answer | Prefix | Consequence |
|---|---|---|
| **Yes** — a client component, a hook, or the generated client running in the browser needs it | `NEXT_PUBLIC_<NAME>` | Next.js **inlines the literal value into the client bundle at build time**. It is public: anyone can read it in DevTools. It is also **frozen at build time** — changing it in Vercel requires a rebuild, not a restart. |
| **No** — only server components, route handlers under `src/app/api/`, or `import 'server-only'` modules need it | `<NAME>` (no prefix) | Stays server-side. Read at runtime, so a Vercel change takes effect on redeploy without a rebuild of the client bundle. |

**Default to no prefix.** Add `NEXT_PUBLIC_` only when you can name the client-side reader. A var without the prefix is `undefined` in the browser — that is the feature, not a bug to work around by adding the prefix.

**Never put a secret behind `NEXT_PUBLIC_`.** Tokens, API keys, and signing secrets go unprefixed and are read server-side only. `NEXT_PUBLIC_API_BASE_URL` is public because a base URL is not a secret; a token is.

### 2. Is it required or optional?

- **Required** — the app cannot function without it. Fail loudly at the read site with a thrown error naming the variable. A silent `undefined` that surfaces 3 layers later as `fetch(undefined/...)` costs an afternoon.
- **Optional with a default** — pick the default at the read site (`process.env.FOO ?? 'sensible-default'`), the way `NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:8000` and `E2E_BASE_URL` defaults to `http://localhost:3000`.

### 3. Which contexts read it?

Check each — this determines which of the propagation steps below apply:

- **Browser bundle** → needs `NEXT_PUBLIC_`.
- **Next.js server runtime** — server components, `src/app/api/allauth/[...path]/route.ts`, `src/lib/branding-server.ts`, `src/lib/policy-documents-server.ts`.
- **`openapi-ts` codegen** — `openapi-ts.config.ts` reads `NEXT_PUBLIC_API_BASE_URL` at generate time. Only relevant for vars that affect client generation.
- **Playwright's dev server** — `playwright.config.ts`'s `webServer.env` block **explicitly enumerates** what it forwards. A var not listed there does not reach the dev server Playwright starts, even when it is set in your shell. This is the layer people forget.
- **The e2e specs themselves** — `e2e/fixtures/auth.ts` reads `E2E_*` vars directly from `process.env` in the Node test process (not the browser).

### 4. Is it a secret?

- Secret → Vercel environment variables (marked sensitive) + GitHub Actions secrets if the deploy workflow needs it. **Never** in `.env.example` with a real value — put a placeholder and a comment on where to get the real one.
- Not secret → still goes in `.env.example` with a working local default.

## Checklist

Work top to bottom. Each step names the file.

### 1. `.env.example` — the contract

The only committed example file. (`e2e/README.md` mentions a `.env.local.example` that **does not exist** in the tree — don't create it as a drive-by; if that inconsistency needs fixing, that's its own change.)

```bash
# One-to-three lines: what it is, which contexts read it, what happens when unset.
# Name the reader module so the next person can grep it.
NEXT_PUBLIC_FEATURE_DOCS_URL=http://localhost:3000/docs
```

Rules:

- **Every var in the tree appears here**, secrets included (with a placeholder value + a comment on where to obtain the real one).
- Comment above the var, not beside it. Say which contexts read it (`codegen + runtime`, `server-only`, `e2e only`).
- Local default must actually work against a local backend on `http://localhost:8000`.

### 2. Your local `.env`

`.env` is untracked and carries real values. Add the var there so your dev server picks it up.

**`.env*` is untracked and full of secrets — this is exactly why `git add -A` is banned in this repo.** Stage explicit paths.

### 3. The read site

Read `process.env.<NAME>` **once**, in one module, and export a typed value. Don't scatter `process.env` reads across components — there are only five files in the whole repo that touch `process.env` today, and that is a property worth keeping.

Server-only var — follow the `import 'server-only'` precedent in `src/lib/branding-server.ts`:

```ts
import 'server-only';

const DOCS_API_TOKEN = process.env.DOCS_API_TOKEN;

if (!DOCS_API_TOKEN) {
  throw new Error(
    'DOCS_API_TOKEN is not set. Add it to .env (see .env.example) and to the ' +
      'Vercel project environment for every deployed environment.'
  );
}

export { DOCS_API_TOKEN };
```

Client-reachable var:

```ts
// Next.js inlines this literal at build time — the whole expression must be
// statically analyzable. `process.env[name]` with a computed key does NOT work.
export const DOCS_URL = process.env.NEXT_PUBLIC_FEATURE_DOCS_URL ?? '/docs';
```

- **`process.env.FOO` must be written literally** for the `NEXT_PUBLIC_` inlining to happen. Destructuring (`const { NEXT_PUBLIC_FOO } = process.env`) or dynamic access (`process.env[key]`) silently produces `undefined` in the client bundle.
- For a required server var, throw at module load with a message naming the variable **and** where to set it.

### 4. `playwright.config.ts` — forward it to the dev server

Only when the e2e dev server needs it. The `webServer.env` block is an explicit allowlist:

```ts
webServer: {
  command: 'npm run dev',
  url: BASE_URL,
  reuseExistingServer: true,
  timeout: 120_000,
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? '',
    NEXT_PUBLIC_FEATURE_DOCS_URL: process.env.NEXT_PUBLIC_FEATURE_DOCS_URL ?? '',
  },
},
```

Vars read by the **spec process** (like the `E2E_*` tokens in `e2e/fixtures/auth.ts`) do **not** need forwarding — the test process inherits your shell. Only vars the **app** needs go in `webServer.env`.

### 5. `openapi-ts.config.ts` — only for codegen-affecting vars

`openapi-ts.config.ts` reads `NEXT_PUBLIC_API_BASE_URL` to set the generated clients' `baseUrl`. Touch this only when the new var changes how clients are generated. Remember: `src/client/` and `src/auth-client/` are **generated — never hand-edited**. Regenerate with `pnpm run openapi-ts` / `pnpm run openapi-ts-auth`.

### 6. Vercel — the deployed environments

The var must exist in the Vercel project for every environment that needs it (Production, Preview, Development). The production deploy workflow (`.github/workflows/deploy-production.yml`) runs:

```
vercel pull --yes --environment=production   # pulls env from the Vercel project
vercel build --prod
vercel deploy --prebuilt --prod
```

The values come from **the Vercel project settings**, pulled at deploy time — **not** from the workflow file and **not** from the repo. So:

- Adding a var to `.env.example` does **not** make it exist in production. Someone must add it in the Vercel dashboard (or via `vercel env add`). Say so explicitly in your PR description — it is a human step the merge does not perform.
- A `NEXT_PUBLIC_` var is inlined during `vercel build --prod`. Changing it in Vercel requires a **new deploy** (push a new `v*` tag), not just a restart.

### 7. `.github/workflows/deploy-production.yml` — only for CI-process vars

Add to the workflow's `env:` block **only** when the var is needed by the GitHub Actions job itself (like `VERCEL_TOKEN`), not by the app. App vars come from `vercel pull`. Secrets go through `${{ secrets.NAME }}` — never inline a secret in the workflow.

The Storybook deploy (`deploy-storybook.yml`) is a separate pipeline; check whether it needs the var too before assuming it doesn't.

### 8. `ai-tools/AGENTS.md` — the **Environment Variables** section

Append to the right block (**App** or **E2E**) with a one-line description, matching the existing shape. AGENTS.md is the canonical doc every agent reads; a var missing here gets re-derived (wrongly) by the next agent.

### 9. `e2e/README.md` — only for `E2E_*` vars

The env table there is the authoritative list for e2e. Add a row: variable, required yes/no, description.

### 10. Gate

```bash
pnpm run lint
pnpm run typecheck
pnpm run format:fix
pnpm run test
```

**No CI runs lint / typecheck / tests in this repo — the workflows only deploy.** This local run is the only gate.

Then prove it end-to-end: restart the dev server (`pnpm run dev`) and confirm the value actually arrives at the read site. For a `NEXT_PUBLIC_` var, check it in the browser — a stale `.next` cache will happily serve you the old inlined literal (`rm -rf .next` if it looks wrong).

## Pitfalls

- **Adding `NEXT_PUBLIC_` "just so it works".** The prefix means "publish this to every visitor". If a var is `undefined` in a client component, the fix is usually to read it in a server component and pass it down as a prop — not to publish it.
- **Forgetting `webServer.env` in `playwright.config.ts`.** It is an explicit allowlist, not a pass-through. The var is set in your shell, the specs see it, the app doesn't. The failure looks like a broken feature, not a missing env var.
- **Assuming a merge provisions the var in Vercel.** It does not. `vercel pull` reads the Vercel project's settings. A human adds it there. Call this out in the PR description.
- **Expecting a `NEXT_PUBLIC_` change to take effect without a rebuild.** It is inlined at build time. Production needs a new `v*` tag.
- **Dynamic `process.env` access.** `process.env[name]` and destructuring defeat Next.js's static replacement. Write `process.env.NEXT_PUBLIC_FOO` literally.
- **Committing a real value.** `.env` is untracked for a reason. `.env.example` gets placeholders. Never `git add -A` — the tree carries untracked `.env*`, generated `schema*.yml`, and regenerated `src/client/` output.
- **Silently defaulting a required var.** `process.env.API_TOKEN ?? ''` turns a config error into a 401 three layers away. Throw at the read site with the variable's name in the message.
- **Scattering reads.** One module owns the read and exports a typed value. Five files touch `process.env` in this repo today; keep it that way.

## Verification

1. `grep -rn '<NAME>' --exclude-dir=node_modules --exclude-dir=.next .` — the var appears in: `.env.example`, its reader module, AGENTS.md, and (if applicable) `playwright.config.ts`, `e2e/README.md`, the deploy workflow. Nowhere else.
2. `.env.example` has the var with a comment and a working local default (or a clearly-marked placeholder for secrets).
3. Unset it locally and start the dev server: a **required** var throws a message naming itself; an **optional** var falls back to its documented default.
4. For a `NEXT_PUBLIC_` var: `rm -rf .next && pnpm run dev`, then confirm the value is present in the browser at the read site.
5. For an e2e-relevant var: `npx playwright test e2e/tests/app/PR000-smoke.spec.ts` still passes.
6. `pnpm run lint` + `pnpm run typecheck` + `pnpm run test` clean.
7. The PR description names the human step: *"Add `<NAME>` to the Vercel project for Production + Preview before merging / before the next `v*` tag."*
