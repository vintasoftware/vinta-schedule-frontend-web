import type { Page, TestInfo } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Page object for the slug-scoped branded login screen at
 * `/o/<slug>/auth/login/`.
 *
 * Public / unauthenticated — does not require a seeded JWT. Branding is
 * resolved server-side via `brandingForTenant(slug: …)`.
 */
export class BrandedLoginPage extends BasePage {
  constructor(page: Page, testInfo: TestInfo) {
    super(page, testInfo);
  }

  async open(slug: string): Promise<void> {
    await this.goto(`/o/${slug}/auth/login/`);
  }

  /**
   * The pre-`/o/` URL. Kept because branded login links were issued at this
   * path and must keep working — it now 308s to `open()`'s URL.
   */
  async openLegacy(slug: string): Promise<void> {
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

  /**
   * The `--primary` token as it computes on the login button — the brand
   * surface when the org configured a primary color, the vinta token
   * otherwise. Read from the element rather than `:root` on purpose: the
   * branded value is declared on a wrapper inside `<html>`, so only an
   * element inside the page sees it.
   */
  async primaryColorToken(): Promise<string> {
    return this.loginButton.evaluate((el) =>
      getComputedStyle(el).getPropertyValue('--primary').trim()
    );
  }

  /** Whether the branding wrapper that carries the brand tokens is present. */
  get brandingThemeWrapper() {
    return this.page.locator('[data-branding-theme]');
  }
}
