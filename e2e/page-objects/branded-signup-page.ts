import type { Page, TestInfo } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Page object for the slug-scoped branded signup screen at
 * `/o/<slug>/auth/signup/`.
 *
 * Public / unauthenticated — does not require a seeded JWT. Branding (and the
 * organization name the field is locked to) is resolved server-side via
 * `brandingForTenant(slug: …)`.
 */
export class BrandedSignupPage extends BasePage {
  constructor(page: Page, testInfo: TestInfo) {
    super(page, testInfo);
  }

  async open(slug: string): Promise<void> {
    await this.goto(`/o/${slug}/auth/signup/`);
  }

  /** The generic, unbranded signup — the control for these assertions. */
  async openGeneric(): Promise<void> {
    await this.goto('/auth/signup/');
  }

  get heading() {
    return this.page.getByRole('heading', { name: /create your account/i });
  }

  get submitButton() {
    return this.page.getByRole('button', { name: /^sign up$/i });
  }

  get organizationInput() {
    return this.page.getByTestId('organization-name-input');
  }

  /** The hint shown only when the link fixed the organization name. */
  get lockedOrganizationHint() {
    return this.page.getByText('Set by your sign-up link.');
  }

  /** Custom (non-vinta) logo rendered by AuthNavbar when branding is branded. */
  get brandedLogo() {
    return this.page.locator('header img').first();
  }

  /** Vinta wordmark shown when branding falls back to defaults. */
  get defaultVintaLogo() {
    return this.page.getByRole('img', { name: 'Vinta' });
  }

  /** The navbar's sign-in action — branded pages keep it inside `/o/<slug>/`. */
  get navSignInLink() {
    return this.page.locator('header a[href*="login"]').first();
  }

  /** Resolved background of the submit button (the brand surface). */
  async submitButtonBackground(): Promise<string> {
    return this.submitButton.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
  }
}
