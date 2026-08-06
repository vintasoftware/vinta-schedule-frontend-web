import { test, expect } from '../../fixtures/auth';
import { BrandedLoginPage } from '../../page-objects/branded-login-page';

/**
 * PR045 — Branded `/auth/login/[slug]/` shows tenant branding
 *
 * Happy path this spec covers when runnable:
 *   1. Visitor opens `/auth/login/<known-qa-slug>/`.
 *   2. The page fetches `brandingForTenant(slug: …)` and renders LoginForm
 *      with that org's public branding (logo / app name) in AuthNavbar.
 *   3. An unknown slug still renders the login form with default vinta
 *      identity (no error / not-found page).
 *
 * The unknown-slug path is always runnable against a live frontend (GraphQL
 * miss → VINTA_DEFAULT_BRANDING). The known-slug happy path needs a QA org
 * that has a public slug + configured branding; set
 * `E2E_BRANDED_LOGIN_SLUG` to that slug (optionally
 * `E2E_BRANDED_LOGIN_APP_NAME` for a stronger logo/alt assertion).
 *
 * Uses the unauthenticated `page` fixture — branded login is public and
 * must not depend on a seeded JWT (memberPage would confuse the flow).
 *
 * Prerequisite (happy path): `E2E_BRANDED_LOGIN_SLUG` for a QA org with
 * public slug + branding against `NEXT_PUBLIC_API_BASE_URL`.
 */

const brandedSlug = process.env.E2E_BRANDED_LOGIN_SLUG?.trim() ?? '';
const brandedAppName = process.env.E2E_BRANDED_LOGIN_APP_NAME?.trim() ?? '';

test.describe('PR045 — Branded login', () => {
  test('unknown slug still shows login with default identity', async ({
    page,
  }, testInfo) => {
    const brandedLogin = new BrandedLoginPage(page, testInfo);
    await brandedLogin.open('no-such-org-pr045-unknown');

    await expect(brandedLogin.welcomeHeading).toBeVisible({ timeout: 15_000 });
    await expect(brandedLogin.loginButton).toBeVisible();
    // Default vinta BrandMark in AuthNavbar header (see auth-navbar.test.tsx).
    await expect(brandedLogin.defaultVintaLogo).toBeVisible({ timeout: 15_000 });
    await expect(brandedLogin.defaultVintaLogo).toHaveAttribute(
      'src',
      /vinta-wordmark/
    );
    await brandedLogin.screenshot('PR045', '01', 'unknown-slug-default');
  });

  test('known slug shows tenant branding on login', async ({
    page,
  }, testInfo) => {
    test.skip(
      !brandedSlug,
      'E2E_BRANDED_LOGIN_SLUG is unset — needs a QA org with a public slug and branding configured against NEXT_PUBLIC_API_BASE_URL. Set E2E_BRANDED_LOGIN_SLUG (and optionally E2E_BRANDED_LOGIN_APP_NAME) to unskip this case.'
    );

    const brandedLogin = new BrandedLoginPage(page, testInfo);
    await brandedLogin.open(brandedSlug);

    await expect(brandedLogin.welcomeHeading).toBeVisible({ timeout: 15_000 });
    await expect(brandedLogin.loginButton).toBeVisible();

    // Branded AuthNavbar renders a custom <img> (not the default BrandMark).
    await expect(brandedLogin.brandedLogo).toBeVisible({ timeout: 15_000 });
    if (brandedAppName) {
      await expect(brandedLogin.brandedLogo).toHaveAttribute(
        'alt',
        brandedAppName
      );
    } else {
      const src = await brandedLogin.brandedLogo.getAttribute('src');
      expect(src).toBeTruthy();
      expect(src).not.toContain('vinta-wordmark');
    }

    await brandedLogin.screenshot('PR045', '02', 'known-slug-branded');
  });
});
