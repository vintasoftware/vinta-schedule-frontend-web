import { test, expect } from '../../fixtures/auth';
import { BrandedSignupPage } from '../../page-objects/branded-signup-page';

/**
 * PR046 — Branded `/o/<slug>/auth/signup/` pre-sets and locks the organization
 *
 * Happy path this spec covers when runnable:
 *   1. Visitor opens `/o/<known-qa-slug>/auth/signup/`.
 *   2. The page resolves `brandingForTenant(slug: …)` and renders SignupForm
 *      with that org's identity, plus the Organization field pre-filled with
 *      the branding app name and disabled.
 *   3. The navbar's sign-in action stays inside the branded flow.
 *   4. An unknown slug still renders signup with default vinta identity and an
 *      empty, editable Organization field (no error / not-found page).
 *
 * The unknown-slug path is always runnable against a live frontend (GraphQL
 * miss → VINTA_DEFAULT_BRANDING). The known-slug happy path needs a QA org
 * that has a public slug + configured branding; set `E2E_BRANDED_LOGIN_SLUG`
 * to that slug (the same org PR045 uses), optionally
 * `E2E_BRANDED_LOGIN_APP_NAME` for a stronger assertion on the locked value.
 *
 * Uses the unauthenticated `page` fixture — branded signup is public and must
 * not depend on a seeded JWT.
 */

const brandedSlug = process.env.E2E_BRANDED_LOGIN_SLUG?.trim() ?? '';
const brandedAppName = process.env.E2E_BRANDED_LOGIN_APP_NAME?.trim() ?? '';

test.describe('PR046 — Branded signup', () => {
  test('unknown slug leaves the organization field empty and editable', async ({
    page,
  }, testInfo) => {
    const signup = new BrandedSignupPage(page, testInfo);
    await signup.open('no-such-org-pr046-unknown');

    await expect(signup.heading).toBeVisible({ timeout: 15_000 });
    await expect(signup.defaultVintaLogo).toBeVisible({ timeout: 15_000 });

    // Falling back to the vinta identity must not put "Vinta Schedule" in the
    // visitor's organization field.
    await expect(signup.organizationInput).toHaveValue('');
    await expect(signup.organizationInput).toBeEnabled();
    await expect(signup.lockedOrganizationHint).toHaveCount(0);

    await signup.screenshot('PR046', '01', 'unknown-slug-editable-org');
  });

  test('generic /auth/signup is unchanged', async ({ page }, testInfo) => {
    const signup = new BrandedSignupPage(page, testInfo);
    await signup.openGeneric();

    await expect(signup.heading).toBeVisible({ timeout: 15_000 });
    await expect(signup.organizationInput).toHaveValue('');
    await expect(signup.organizationInput).toBeEnabled();
    await expect(signup.navSignInLink).toHaveAttribute('href', '/auth/login');

    await signup.screenshot('PR046', '02', 'generic-signup');
  });

  test('known slug pre-fills and locks the organization field', async ({
    page,
  }, testInfo) => {
    test.skip(
      !brandedSlug,
      'E2E_BRANDED_LOGIN_SLUG is unset — needs a QA org with a public slug and branding configured against NEXT_PUBLIC_API_BASE_URL. Set E2E_BRANDED_LOGIN_SLUG (and optionally E2E_BRANDED_LOGIN_APP_NAME) to unskip this case.'
    );

    const signup = new BrandedSignupPage(page, testInfo);
    await signup.open(brandedSlug);

    await expect(signup.heading).toBeVisible({ timeout: 15_000 });

    // Branded AuthNavbar renders a custom <img> (not the default BrandMark).
    await expect(signup.brandedLogo).toBeVisible({ timeout: 15_000 });

    await expect(signup.organizationInput).toBeDisabled();
    await expect(signup.lockedOrganizationHint).toBeVisible();
    if (brandedAppName) {
      await expect(signup.organizationInput).toHaveValue(brandedAppName);
    } else {
      await expect(signup.organizationInput).not.toHaveValue('');
    }

    // The branded flow must not hand the visitor off to the generic pages.
    await expect(signup.navSignInLink).toHaveAttribute(
      'href',
      `/o/${brandedSlug}/auth/login`
    );

    await signup.screenshot('PR046', '03', 'known-slug-locked-org');
  });
});
