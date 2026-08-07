import { test } from '../../fixtures/auth';
import { LoginPage } from '../../page-objects/login-page';

/**
 * PR044 — Post-auth navigation honors the server-resolved OAuth `destination`
 *
 * Happy path this spec is meant to cover, once runnable:
 *   1. Visitor starts a social-provider login from `/auth/login`.
 *   2. Completes the real provider's consent screen (Google/GitHub/etc.).
 *   3. The provider redirects back to `/auth/social/:provider/callback`.
 *   4. The SPA's callback route handler reads `destination` from the
 *      authenticated JSON response and redirects the browser there, instead
 *      of deciding the landing page from client-sent `next`/`callback_url`
 *      state (see the organization-auth-branding handoff, "Resolved
 *      post-auth destination").
 *   5. The browser lands on the org's configured branding `redirect_url` (or
 *      the platform dashboard fallback when none is configured).
 *
 * BLOCKED — cannot run against a live identity provider from this harness:
 * `memberPage` / `adminPage` bypass login entirely by seeding a JWT straight
 * into `localStorage` (see `e2e/fixtures/auth.ts`); neither fixture drives a
 * real OAuth handshake, and there is no QA social account whose Google/
 * GitHub consent screen this harness can click through non-interactively.
 * The `destination`-based redirect itself is covered by
 * `src/app/auth/social/[provider]/callback/route.test.ts` (unit,
 * `handleProviderLoginCallback — destination-based redirect`), which is the
 * merge gate for this behavior until a testable IdP (or a backend-provided
 * OAuth test double) makes this spec runnable.
 *
 * Prerequisite once unblocked: a QA social account whose consent screen can
 * be automated (or an IdP test double), plus a QA org with a configured
 * branding `redirect_url`, and `E2E_MEMBER_ACCESS_TOKEN` for the fixture's
 * baseline session.
 */

test.describe('PR044 — OAuth destination navigation', () => {
  test.skip('member completes social login and lands on the resolved destination', async ({
    memberPage,
  }, testInfo) => {
    // Scaffolding for when a testable IdP becomes available.
    const loginPage = new LoginPage(memberPage, testInfo);
    await loginPage.open();
  });
});
