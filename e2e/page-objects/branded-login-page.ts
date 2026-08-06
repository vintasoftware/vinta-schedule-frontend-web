import type { Page, TestInfo } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Page object for the slug-scoped branded login screen at
 * `/auth/login/<slug>/`.
 *
 * Public / unauthenticated — does not require a seeded JWT. Branding is
 * resolved server-side via `brandingForTenant(slug: …)`.
 */
export class BrandedLoginPage extends BasePage {
  constructor(page: Page, testInfo: TestInfo) {
    super(page, testInfo);
  }

  async open(slug: string): Promise<void> {
    await this.goto(`/auth/login/${slug}/`);
  }

  get welcomeHeading() {
    return this.page.getByRole('heading', { name: /welcome back/i });
  }

  get loginButton() {
    return this.page.getByRole('button', { name: /^login$/i });
  }

  /** Vinta wordmark shown when branding falls back to defaults (AuthNavbar `<header>`). */
  get defaultVintaLogo() {
    return this.page.getByRole('img', { name: 'Vinta' });
  }

  /** Custom (non-vinta) logo rendered by AuthNavbar when branding is branded. */
  get brandedLogo() {
    return this.page.locator('header img').first();
  }
}
