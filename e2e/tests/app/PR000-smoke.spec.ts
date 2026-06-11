import { test, expect } from '../../fixtures/auth';
import { BasePage } from '../../page-objects/base-page';

/**
 * PR000 — Smoke test
 *
 * Verifies the (app) shell loads correctly for a member session:
 *   1. The page navigates to `/` inside the (app) route group.
 *   2. The sidebar nav is visible (confirms the shell rendered, not the
 *      loading/redirect/no-access fallback).
 *   3. Member-only nav items are present ("My calendars", "Events").
 *   4. Admin-only nav items are absent from a member session ("Team").
 *
 * Prerequisite: `E2E_MEMBER_ACCESS_TOKEN` must be set to a valid JWT for a
 * member account in the QA test org against the live API configured via
 * `NEXT_PUBLIC_API_BASE_URL`.
 */

test.describe('PR000 — App shell smoke', () => {
  test('member session: shell renders with member nav', async ({
    memberPage,
  }, testInfo) => {
    const basePage = new BasePage(memberPage, testInfo);

    // Navigate to the (app) root — the AppLayoutClient will bootstrap auth
    // from localStorage (seeded by the fixture) and render the shell.
    await basePage.goto('/');

    // The sidebar nav must be visible — proves the shell rendered rather than
    // showing the LoadingView or redirecting away.
    const nav = memberPage.getByRole('navigation');
    await expect(nav).toBeVisible({ timeout: 15_000 });

    // Member nav items must be present.
    await expect(
      memberPage.getByRole('button', { name: /my calendars/i })
    ).toBeVisible();
    await expect(
      memberPage.getByRole('button', { name: /events/i })
    ).toBeVisible();
    await expect(
      memberPage.getByRole('button', { name: /availability/i })
    ).toBeVisible();

    // Admin-only nav item must NOT be visible for a member.
    await expect(
      memberPage.getByRole('button', { name: /^team$/i })
    ).not.toBeVisible();

    // Screenshot 01 — shell loaded.
    await basePage.screenshot('PR000', '01', 'shell-loaded');
  });
});
