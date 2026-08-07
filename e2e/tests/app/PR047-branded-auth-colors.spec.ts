import { test, expect } from '../../fixtures/auth';
import { BrandedLoginPage } from '../../page-objects/branded-login-page';

/**
 * PR047 — Branded auth pages paint the org's brand colors
 *
 * Happy path this spec covers when runnable:
 *   1. Visitor opens `/o/<known-qa-slug>/auth/login/`.
 *   2. The page declares the org's `primaryColor` / `secondaryColor` as CSS
 *      custom properties on a wrapper around the auth shell, so primary
 *      buttons, links and focus rings render in the brand color rather than
 *      the vinta blue.
 *   3. An unknown slug (or an org that configured no colors) renders the
 *      vinta token with no branding wrapper at all.
 *
 * The unknown-slug path is always runnable against a live frontend (GraphQL
 * miss → VINTA_DEFAULT_BRANDING, whose colors are empty). The known-slug case
 * needs a QA org with a public slug AND a configured primary color; set
 * `E2E_BRANDED_LOGIN_SLUG` to that slug and `E2E_BRANDED_PRIMARY_COLOR` to the
 * hex value it was configured with.
 *
 * Uses the unauthenticated `page` fixture — branded login is public.
 */

const brandedSlug = process.env.E2E_BRANDED_LOGIN_SLUG?.trim() ?? '';
const brandedPrimary = process.env.E2E_BRANDED_PRIMARY_COLOR?.trim() ?? '';

test.describe('PR047 — Branded auth colors', () => {
  test('unknown slug keeps the vinta palette and adds no branding wrapper', async ({
    page,
  }, testInfo) => {
    const brandedLogin = new BrandedLoginPage(page, testInfo);
    await brandedLogin.open('no-such-org-pr047-unknown');

    await expect(brandedLogin.welcomeHeading).toBeVisible({ timeout: 15_000 });
    await expect(brandedLogin.brandingThemeWrapper).toHaveCount(0);

    // The vinta token is an oklch value from tokens.css, never a hex literal.
    expect(await brandedLogin.primaryColorToken()).not.toMatch(/^#/);

    await brandedLogin.screenshot('PR047', '01', 'unknown-slug-vinta-palette');
  });

  test('legacy /auth/login/<slug> still reaches the branded page', async ({
    page,
  }, testInfo) => {
    const brandedLogin = new BrandedLoginPage(page, testInfo);
    await brandedLogin.openLegacy('no-such-org-pr047-unknown');

    // The pre-`/o/` URL 308s to the canonical one — previously-issued branded
    // login links must keep working.
    await expect(page).toHaveURL(/\/o\/no-such-org-pr047-unknown\/auth\/login/);
    await expect(brandedLogin.welcomeHeading).toBeVisible({ timeout: 15_000 });

    await brandedLogin.screenshot('PR047', '02', 'legacy-url-redirect');
  });

  test('known slug paints the brand primary color', async ({
    page,
  }, testInfo) => {
    test.skip(
      !brandedSlug || !brandedPrimary,
      'E2E_BRANDED_LOGIN_SLUG and E2E_BRANDED_PRIMARY_COLOR are required — needs a QA org with a public slug and a configured primary color against NEXT_PUBLIC_API_BASE_URL.'
    );

    const brandedLogin = new BrandedLoginPage(page, testInfo);
    await brandedLogin.open(brandedSlug);

    await expect(brandedLogin.welcomeHeading).toBeVisible({ timeout: 15_000 });
    await expect(brandedLogin.brandingThemeWrapper).toHaveCount(1);

    expect((await brandedLogin.primaryColorToken()).toLowerCase()).toBe(
      brandedPrimary.toLowerCase()
    );

    await brandedLogin.screenshot('PR047', '03', 'known-slug-brand-color');
  });
});
