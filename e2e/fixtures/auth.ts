import { test as base, type Page } from '@playwright/test';

/**
 * Auth-bypass fixture for Playwright e2e tests.
 *
 * The (app) shell gate (`AppLayoutClient`) works as follows:
 *
 *   1. On mount it reads `localStorage.getItem('accessToken')`.
 *      If present → isAuthenticated = true → triggers the TanStack Query
 *      call to `GET /organizations/current`.
 *   2. `useCurrentOrganization` sends an `Authorization: Bearer <token>`
 *      header (via the fetch interceptor in `authentication-fetch-interceptors.ts`).
 *   3. A 200 response → `isOnboarded` → shell renders with role-correct nav.
 *
 * The `ClientTokenStorageStrategy` also reads/writes `localStorage.accessToken`
 * and `localStorage.refreshToken`, and mirrors them to cookies.
 *
 * To bypass auth in tests:
 *   - Seed `localStorage.accessToken` (and `localStorage.refreshToken`) with
 *     real JWT tokens issued by the live backend for the test accounts.
 *   - These come from environment variables so secrets are never committed.
 *
 * Environment variables required:
 *   E2E_MEMBER_ACCESS_TOKEN   — JWT for a member account in the test org
 *   E2E_MEMBER_REFRESH_TOKEN  — corresponding refresh token (optional but keeps
 *                               the session alive for longer tests)
 *   E2E_ADMIN_ACCESS_TOKEN    — JWT for an admin account in the test org
 *   E2E_ADMIN_REFRESH_TOKEN   — corresponding refresh token (optional)
 *
 * If these are not set the fixture warns and seeds a placeholder token; the
 * shell will then call the live API with an invalid token and redirect to the
 * no-access / loading state (the test will fail gracefully rather than hang).
 *
 * IMPORTANT: these are real JWT tokens for a seeded QA organization on the live
 * (or staging) backend. Rotate them if compromised. Never commit them.
 */

export type AuthRole = 'member' | 'admin';

/**
 * Seed `localStorage` with the token pair for the given role.
 *
 * Also mirrors the access token to a cookie so the server-side fetch
 * interceptor can pick it up on SSR requests.
 */
async function seedSession(page: Page, role: AuthRole): Promise<void> {
  const accessVar =
    role === 'admin' ? 'E2E_ADMIN_ACCESS_TOKEN' : 'E2E_MEMBER_ACCESS_TOKEN';
  const refreshVar =
    role === 'admin' ? 'E2E_ADMIN_REFRESH_TOKEN' : 'E2E_MEMBER_REFRESH_TOKEN';

  const accessToken = process.env[accessVar] ?? '';
  const refreshToken = process.env[refreshVar] ?? '';

  if (!accessToken) {
    console.warn(
      `[auth-fixture] ${accessVar} is not set. ` +
        'The shell will fail to authenticate against the live API. ' +
        'Set it to a valid JWT for the QA test org.'
    );
  }

  // Navigate to a minimal page first so we have a document context in which
  // to run localStorage / cookie mutations.
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await page.evaluate(
    ({ accessToken, refreshToken }) => {
      // Mirrors ClientTokenStorageStrategy.setAccessToken / setRefreshToken
      localStorage.setItem('accessToken', accessToken);
      document.cookie = `accessToken=${accessToken}; path=/; SameSite=Lax`;

      if (refreshToken) {
        localStorage.setItem('refreshToken', refreshToken);
        document.cookie = `refreshToken=${refreshToken}; path=/; SameSite=Lax`;
      }
    },
    { accessToken, refreshToken }
  );
}

// ---------------------------------------------------------------------------
// Fixture types
// ---------------------------------------------------------------------------

export interface AuthFixtures {
  /** A page pre-seeded with a member session. */
  memberPage: Page;
  /** A page pre-seeded with an admin session. */
  adminPage: Page;
}

// ---------------------------------------------------------------------------
// Extended test object
// ---------------------------------------------------------------------------

/**
 * `test` extended with `memberPage` and `adminPage` fixtures.
 *
 * Import this `test` instead of `@playwright/test`'s `test` in specs that
 * need an authenticated context.
 *
 * @example
 * ```ts
 * import { test, expect } from '../fixtures/auth';
 *
 * test('shell renders', async ({ memberPage }) => {
 *   await memberPage.goto('/');
 *   await expect(memberPage.getByRole('navigation')).toBeVisible();
 * });
 * ```
 */
export const test = base.extend<AuthFixtures>({
  memberPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await seedSession(page, 'member');
    await use(page);
    await context.close();
  },

  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await seedSession(page, 'admin');
    await use(page);
    await context.close();
  },
});

export { expect } from '@playwright/test';
