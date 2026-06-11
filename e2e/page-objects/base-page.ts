import type { Page, TestInfo } from '@playwright/test';

/**
 * BasePage — minimal page-object root class.
 *
 * Every feature page-object extends this. It holds the Playwright `Page`
 * reference and provides the shared screenshot helper that follows the
 * project convention:
 *
 *   testInfo.outputPath('<id>-<NN>-<slug>.png')
 *
 * All feature page-objects should call `screenshot()` at meaningful
 * checkpoints so the collect-screenshots script can aggregate them into
 * `pr-screenshots/`.
 */
export class BasePage {
  constructor(
    protected readonly page: Page,
    protected readonly testInfo: TestInfo
  ) {}

  /**
   * Navigate to `path` and wait for the network to settle.
   */
  async goto(path: string): Promise<void> {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Take a screenshot and write it to the test-result output directory.
   *
   * @param id    The use-case id, e.g. `PR000`.
   * @param seq   A two-digit sequence number, e.g. `01`.
   * @param slug  A short kebab-case description, e.g. `shell-loaded`.
   */
  async screenshot(id: string, seq: string, slug: string): Promise<void> {
    const filename = `${id}-${seq}-${slug}.png`;
    await this.page.screenshot({
      path: this.testInfo.outputPath(filename),
      fullPage: false,
    });
  }
}
