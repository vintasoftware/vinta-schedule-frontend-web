# E2E Tests — Playwright

## Overview

Playwright-based end-to-end tests for the Vinta Schedule frontend.
Tests run against a **real dev server talking to the live API** — there is no
mock layer. All 38 use-cases defined in `QA_USE_CASES.md` map to specs in
`e2e/tests/`.

## Environment requirements

| Variable                   | Required | Description                                                                           |
| -------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes      | Base URL of the live (or staging) backend API, e.g. `https://api.staging.example.com` |
| `E2E_MEMBER_ACCESS_TOKEN`  | Yes      | Valid JWT for a **member** account in the QA test org                                 |
| `E2E_MEMBER_REFRESH_TOKEN` | No       | Refresh token for the member account (extends session)                                |
| `E2E_ADMIN_ACCESS_TOKEN`   | Yes      | Valid JWT for an **admin** account in the QA test org                                 |
| `E2E_ADMIN_REFRESH_TOKEN`  | No       | Refresh token for the admin account                                                   |
| `E2E_BASE_URL`             | No       | Override the dev server URL (default: `http://localhost:3000`)                        |

Copy `.env.local.example` to `.env.local` and fill in the token values.
**Never commit tokens.**

### Obtaining tokens

Authenticate against the live API with the QA accounts and capture the JWT
pair from the `/auth/login` or `/auth/token/` response. Rotate tokens if
compromised.

## Running tests

```bash
# Install browsers (once per machine / CI image):
npx playwright install chromium

# Run all e2e specs (starts dev server automatically):
NEXT_PUBLIC_API_BASE_URL=https://api.staging.example.com \
  E2E_MEMBER_ACCESS_TOKEN=<token> \
  E2E_ADMIN_ACCESS_TOKEN=<token> \
  npx playwright test

# Run a single spec:
npx playwright test e2e/tests/app/PR000-smoke.spec.ts

# Collect screenshots into pr-screenshots/:
node e2e/scripts/collect-screenshots.mjs
```

## Why tests may not run in sandbox / CI without secrets

The auth-bypass fixture (`e2e/fixtures/auth.ts`) seeds `localStorage.accessToken`
with a real JWT so the shell's auth gate (`AppLayoutClient`) considers the user
authenticated. It then makes a live `GET /organizations/current` call. Without
a valid token **and** a reachable API, that call returns 401/404 and the shell
redirects away — the assertions fail.

This is correct-by-construction: the harness is right, but it requires
real credentials to run green.

## Directory layout

```
e2e/
  fixtures/
    auth.ts            # memberPage / adminPage fixtures (seeds localStorage)
  page-objects/
    base-page.ts       # BasePage: goto, screenshot helper
  scripts/
    collect-screenshots.mjs  # Post-run: copy test-results/*.png → pr-screenshots/
  tests/
    app/
      PR000-smoke.spec.ts    # Smoke: member session loads the shell
      PA001-team-list.spec.ts         # Phase 1 (added in Phase 1)
      …                               # One spec per use-case
  tsconfig.json        # Separate TS config for the e2e tree
  README.md            # This file
```

## Screenshot convention

Specs write screenshots via:

```ts
await basePage.screenshot('<id>', '<NN>', '<slug>');
// writes: testInfo.outputPath('<id>-<NN>-<slug>.png')
// e.g.   test-results/…/PR000-01-shell-loaded.png
```

After a run, `node e2e/scripts/collect-screenshots.mjs` moves them to
`pr-screenshots/` (gitignored, stable location for review).
