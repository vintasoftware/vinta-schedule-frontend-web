---
name: add-e2e-test
description: Add a Playwright end-to-end spec to the existing `e2e/` suite in vinta-schedule-frontend-web — pick the next free PR###/PA### id, append the row to QA_USE_CASES.md, add a page object under e2e/page-objects/, and write the spec at e2e/tests/app/<ID>-<slug>.spec.ts using the memberPage / adminPage auth fixtures. Use when the user says "add an e2e test", "cover this flow end-to-end", "write a Playwright spec", "add a QA use-case with a test", or when a plan phase's Tests → E2E line names a spec that doesn't exist yet. NOT for unit or component tests (Vitest + Testing Library, colocated `*.test.tsx`).
---

# Add an E2E test

This project already has a real Playwright suite. This skill **appends to it** — it does not bootstrap anything and does not invent new conventions. Read [e2e/README.md](e2e/README.md) before writing.

The load-bearing fact: **these tests hit a live backend. There is no mocking layer.** A spec that passes locally passes because a real JWT reached a real API. Design assertions accordingly — no fixture data you control, no seeded database you can reset.

## What already exists (do not re-create)

| Thing | Path | Notes |
|---|---|---|
| Playwright config | [playwright.config.ts](playwright.config.ts) | `testDir: 'e2e/tests'`, `outputDir: 'test-results'`, single `chromium` project, baseURL from `E2E_BASE_URL` (default `http://localhost:3000`), 30s test timeout / 10s expect timeout, CI retries 1 + workers 1. `webServer` auto-starts the dev server with `reuseExistingServer: true`. |
| Auth fixtures | [e2e/fixtures/auth.ts](e2e/fixtures/auth.ts) | Exports `test` (extended) + `expect`. Fixtures: `memberPage`, `adminPage`. Each seeds `localStorage.accessToken` / `refreshToken` from `E2E_{MEMBER,ADMIN}_{ACCESS,REFRESH}_TOKEN` and mirrors them to cookies for the SSR fetch interceptor. |
| Page-object root | [e2e/page-objects/base-page.ts](e2e/page-objects/base-page.ts) | `BasePage` — `goto(path)` (waits for `networkidle`) + `screenshot(id, seq, slug)` → `testInfo.outputPath('<id>-<seq>-<slug>.png')`. |
| Use-case index | [QA_USE_CASES.md](QA_USE_CASES.md) | Durable, ids immutable. Feature-grouped tables: `ID | Role | Happy-path description | Spec path`. |
| Screenshot collector | [e2e/scripts/collect-screenshots.mjs](e2e/scripts/collect-screenshots.mjs) | Copies every PNG from `test-results/` into the gitignored `pr-screenshots/`. |
| Reference spec | [e2e/tests/app/PR000-smoke.spec.ts](e2e/tests/app/PR000-smoke.spec.ts) | The canonical shape. Copy its structure, not its assertions. |
| e2e tsconfig | `e2e/tsconfig.json` | Separate TS config for the e2e tree. |

## Commands

**There is no `test:e2e` npm script.** Invoke Playwright directly:

```bash
npx playwright install chromium          # once per machine / CI image

npx playwright test                      # whole suite
npx playwright test e2e/tests/app/PA003-invite-member.spec.ts   # one spec
npx playwright test --headed --debug e2e/tests/app/PA003-invite-member.spec.ts

node e2e/scripts/collect-screenshots.mjs # after a run: test-results/**.png → pr-screenshots/
```

Required environment (see [e2e/README.md](e2e/README.md)):

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Live / staging backend the dev server talks to |
| `E2E_MEMBER_ACCESS_TOKEN` | Yes | JWT for a **member** account in the QA org |
| `E2E_ADMIN_ACCESS_TOKEN` | Yes | JWT for an **admin** account in the QA org |
| `E2E_MEMBER_REFRESH_TOKEN` / `E2E_ADMIN_REFRESH_TOKEN` | No | Extend the session on longer specs |
| `E2E_BASE_URL` | No | Override the dev server URL |

Without valid tokens **and** a reachable API the shell redirects away and every assertion fails. That is correct-by-construction, not a broken harness — don't "fix" it by weakening assertions.

## Decision questions

Answer before writing:

1. **Does this flow already have a use-case id?** Grep [QA_USE_CASES.md](QA_USE_CASES.md). If a row exists with an empty **Spec path**, you are filling it in — reuse that id, do not mint a new one.
2. **Member or admin?** Drives both the id prefix and the fixture:
   - `PR###` → **member** use-case → `memberPage` fixture.
   - `PA###` → **admin** use-case → `adminPage` fixture.
   - (Note this is the inverse of the generic "PA = patient app" convention some Vinta repos use. In this repo `PA` = admin. Follow the repo.)
3. **Which feature group?** The `## ` section in [QA_USE_CASES.md](QA_USE_CASES.md) (Foundation / Team & Invitations / Calendars / …). New feature area → new section with a `---` separator above it.
4. **Is the flow mutating?** Invites, revokes, disables, creates all write to the **live QA org**. Decide the cleanup strategy up front (see [Pitfalls](#pitfalls)) — a spec that leaves permanent junk in the QA org is a defect.
5. **What are the distinct rendered states?** One screenshot per state, not just the final one — landing view, each modal / wizard step, the success toast, the settled list.

## Checklist

### 1. Pick the id

```bash
grep -oE '^\| (PR|PA)[0-9]{3}' QA_USE_CASES.md | sort -u | tail -5
```

Take the next unused number **for the whole file** — the two prefixes share one number space in this repo (PR000, PA001…PA006, PR007…). Never renumber, never reuse a retired id, never insert in the middle. Numbers reflect arrival order, not priority.

### 2. Append the row to `QA_USE_CASES.md`

Add one row to the right feature-group table, with the spec path filled in:

```markdown
| PA007 | admin | Admin edits a member's role; the row reflects the new role after save | `e2e/tests/app/PA007-edit-member-role.spec.ts` |
```

- **Role** column: `member` or `admin` (lowercase), matching the prefix key at the top of the file.
- **Happy-path description**: one line, user language, present tense. No component names, no endpoints, no query keys.
- Keep the markdown table columns padded consistently with the neighbours — `pnpm run format` will fix them; run it.

### 3. Add or extend the page object

One page object per screen, under `e2e/page-objects/<feature>-page.ts`, extending `BasePage`:

```ts
import type { Page, TestInfo } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Page object for the team management screen at `/team`.
 */
export class TeamPage extends BasePage {
  constructor(page: Page, testInfo: TestInfo) {
    super(page, testInfo);
  }

  async open(): Promise<void> {
    await this.goto('/team');
  }

  get inviteButton() {
    return this.page.getByRole('button', { name: /invite member/i });
  }

  memberRow(email: string) {
    return this.page.getByRole('row', { name: new RegExp(email, 'i') });
  }
}
```

Rules:

- **Locators are getters or methods on the page object, never inline in the spec.** The spec reads as a user story; the page object holds the DOM knowledge.
- **Role-based locators first** (`getByRole`, `getByLabel`, `getByText`) — they match how the existing specs and the shadcn/ui atoms are queried. Reach for `data-testid` only when nothing accessible identifies the element, and add the attribute to the component in the same PR.
- `page` and `testInfo` are `protected` on `BasePage` — subclasses use them directly, specs never touch them.

### 4. Write the spec

At `e2e/tests/app/<ID>-<kebab-slug>.spec.ts`. Slug is short and describes the flow (`PA003-invite-member`, `PR008-create-calendar`).

```ts
import { test, expect } from '../../fixtures/auth';
import { TeamPage } from '../../page-objects/team-page';

/**
 * PA007 — Admin edits a member's role
 *
 * 1. Admin opens /team.
 * 2. Opens the row action menu for a known QA member.
 * 3. Changes the role and saves.
 * 4. The row reflects the new role and a success toast appears.
 *
 * Prerequisite: `E2E_ADMIN_ACCESS_TOKEN` must be a valid JWT for an admin
 * account in the QA test org against `NEXT_PUBLIC_API_BASE_URL`.
 */

test.describe('PA007 — Edit member role', () => {
  test('admin session: role change persists in the row', async ({
    adminPage,
  }, testInfo) => {
    const teamPage = new TeamPage(adminPage, testInfo);

    await teamPage.open();
    await expect(teamPage.inviteButton).toBeVisible({ timeout: 15_000 });
    await teamPage.screenshot('PA007', '01', 'team-list');

    // …drive the flow through page-object methods…
    await teamPage.screenshot('PA007', '02', 'role-dialog-open');

    await expect(adminPage.getByRole('status')).toContainText(/role updated/i);
    await teamPage.screenshot('PA007', '03', 'role-updated');
  });
});
```

Required shape (matches [PR000-smoke.spec.ts](e2e/tests/app/PR000-smoke.spec.ts)):

- **Import `test` / `expect` from `../../fixtures/auth`**, never from `@playwright/test` — a spec importing the raw `test` gets no session and fails at the shell gate.
- `test.describe('<ID> — <Title>', …)` wrapping one `test(...)` per use-case.
- Destructure the fixture you need (`{ memberPage }` or `{ adminPage }`) plus `testInfo` as the **second** callback arg.
- A file-header doc comment: the id, the numbered happy path, and the env prerequisite.
- **First assertion is a shell-rendered proof** with a generous timeout (`{ timeout: 15_000 }`) — the first live API round-trip is the slow one. Without it you get a flaky failure that looks like a bug in your flow.

### 5. Screenshots — one per rendered state

```ts
await teamPage.screenshot('PA007', '02', 'role-dialog-open');
// → testInfo.outputPath('PA007-02-role-dialog-open.png')
```

- Zero-padded two-digit sequence, kebab-case slug describing **what is on screen**.
- **Never hard-code `pr-screenshots/` in a spec.** The spec writes to Playwright's per-test output dir via `testInfo.outputPath`; `node e2e/scripts/collect-screenshots.mjs` moves them afterwards. `pr-screenshots/` is gitignored — drag the files into the PR description in numeric order so reviewers see the journey, not just the destination.

### 6. Run it

```bash
NEXT_PUBLIC_API_BASE_URL=<staging-api> \
  E2E_ADMIN_ACCESS_TOKEN=<jwt> \
  npx playwright test e2e/tests/app/PA007-edit-member-role.spec.ts

node e2e/scripts/collect-screenshots.mjs
```

Run it **three times**. Live-backend specs that pass once and fail once are the norm for a bad wait, not bad luck.

### 7. Gate the change

The e2e tree has its own `e2e/tsconfig.json` but is covered by the repo gates:

```bash
pnpm run lint
pnpm run typecheck
pnpm run format:fix
```

**No CI job runs e2e (or lint, or typecheck, or tests) in this repo — the workflows only deploy.** Your local run is the only signal.

## Pitfalls

- **Importing `test` from `@playwright/test`.** No fixture → no seeded token → `AppLayoutClient` redirects → every assertion fails with a confusing "element not found". Always import from `../../fixtures/auth`.
- **Assuming seeded data.** There is no seed step and no reset. The QA org's contents are whatever the last run left behind. Assert on **what your spec created** (a uniquely-suffixed email, `qa+e2e-${Date.now()}@…`), never on row counts, "the first row", or a hard-coded record you didn't create in this test.
- **Leaving mutations behind.** Invites, calendars, and disabled users persist in the live QA org forever. Either clean up in the spec (revoke what you invited) or use a disposable, timestamp-suffixed identifier so junk is at least traceable and never collides. Never disable a QA account your other specs log in with.
- **`waitForLoadState('networkidle')` as a substitute for assertions.** `BasePage.goto` already does it. TanStack Query refetches after idle — assert on the element you care about with an explicit timeout instead of sleeping.
- **Testing admin-only surface with `memberPage`.** The nav hides admin items from members (PR000 asserts exactly this). Match fixture to prefix: `PA###` → `adminPage`, `PR###` → `memberPage`.
- **Renumbering ids to "tidy up".** Ids are referenced by spec filenames, PR descriptions, and bug tickets. They are immutable. A gap in the numbering is fine.
- **Adding a `test:e2e` script because a plan or skill mentions one.** This repo deliberately invokes Playwright directly. Don't add one as a drive-by; if the team wants it, that's its own change.
- **Screenshotting only the final state.** Reviewers need the journey. One screenshot per distinct rendered state.
- **Hard-coding `http://localhost:3000` in a spec.** `baseURL` is configured; pass paths (`/team`), not URLs.

## Verification

1. `npx playwright test e2e/tests/app/<ID>-<slug>.spec.ts` passes three consecutive runs against the live API.
2. `node e2e/scripts/collect-screenshots.mjs` lands one `<ID>-<NN>-<slug>.png` per rendered state in `pr-screenshots/`.
3. `grep '<ID>' QA_USE_CASES.md` returns exactly one row, with the **Spec path** column matching the file you created.
4. The spec's id, its filename, and its `test.describe` title all agree.
5. `pnpm run lint` + `pnpm run typecheck` + `pnpm run format` clean.
6. Nothing permanent was left in the QA org that a future run would trip over.
