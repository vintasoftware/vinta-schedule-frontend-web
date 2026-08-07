import { BasePage } from './base-page';

/**
 * Page object for the generic login screen at `/auth/login`.
 *
 * Only exposes what's needed to start a social-provider login (PR044). The
 * rest of the flow — the provider's own consent screen and the resulting
 * callback — happens off-app and isn't automatable by this page object; see
 * the blocker note in `e2e/tests/app/PR044-oauth-destination.spec.ts`.
 */
export class LoginPage extends BasePage {
  async open(): Promise<void> {
    await this.goto('/auth/login');
  }

  socialLoginButton(providerName: string) {
    return this.page.getByRole('button', {
      name: new RegExp(`sign in with ${providerName}`, 'i'),
    });
  }
}
