import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration.
 *
 * Base URL: the dev server running against the live API. Supply
 * `E2E_BASE_URL` when the dev server is running on a non-default port or
 * host. `NEXT_PUBLIC_API_BASE_URL` must be set (or available via .env) so
 * the dev server talks to the correct backend.
 *
 * The webServer block starts the Next.js dev server automatically when
 * `npx playwright test` is run without an already-running server.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: 'e2e/tests',
  outputDir: 'test-results',

  /* Screenshot / trace on failure */
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  /* Single Chromium project for the smoke suite */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Global timeouts */
  timeout: 30_000,
  expect: { timeout: 10_000 },

  /* Fail-fast on CI; keep all results locally */
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,

  /**
   * Start the dev server before running tests.
   *
   * - NEXT_PUBLIC_API_BASE_URL is forwarded from the host environment so the
   *   dev server talks to the correct live API.
   * - `reuseExistingServer: true` prevents a second start when the dev server
   *   is already running (e.g. in a local workflow where you `npm run dev`
   *   first).
   */
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? '',
    },
  },

  /* Playwright report output */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
});
