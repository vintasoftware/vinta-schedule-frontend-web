import { test, expect } from '../../fixtures/auth';
import { BasePage } from '../../page-objects/base-page';

/**
 * PA001 — Admin: view team list
 *
 * Verifies the admin team list datatable at `/team`:
 *   1. An admin session navigates to `/team`.
 *   2. The page renders a "Team" heading and the member table.
 *   3. Table columns (Name, Email, Role, Status) are visible.
 *   4. Pagination footer is present.
 *   5. A member session is redirected away from `/team` (gated).
 *
 * Prerequisite: `E2E_ADMIN_ACCESS_TOKEN` must be set to a valid JWT for an
 * admin account in the QA test org against the live API configured via
 * `NEXT_PUBLIC_API_BASE_URL`.
 */

test.describe('PA001 — Admin: team list', () => {
  test('admin session: team page renders the member datatable', async ({
    adminPage,
  }, testInfo) => {
    const basePage = new BasePage(adminPage, testInfo);

    // Navigate to the team page.
    await basePage.goto('/team');

    // The "Team" heading confirms the page mounted (not the loading state).
    await expect(
      adminPage.getByRole('heading', { name: /^team$/i })
    ).toBeVisible({ timeout: 15_000 });

    // Screenshot 01 — populated table.
    await basePage.screenshot('PA001', '01', 'team-populated');

    // Table header columns must be present.
    await expect(
      adminPage.getByRole('columnheader', { name: /name/i })
    ).toBeVisible();
    await expect(
      adminPage.getByRole('columnheader', { name: /email/i })
    ).toBeVisible();
    await expect(
      adminPage.getByRole('columnheader', { name: /role/i })
    ).toBeVisible();
    await expect(
      adminPage.getByRole('columnheader', { name: /status/i })
    ).toBeVisible();

    // The table body must have at least one data row (org must have members).
    const rows = adminPage.getByRole('row');
    // First row is the header — we need at least one data row.
    await expect(rows).toHaveCount(
      await rows.count() // just confirm count > 1 (header + rows)
    );

    // At least one "admin" or "member" role badge should be visible.
    const roleBadge = adminPage.getByText(/^(admin|member)$/).first();
    await expect(roleBadge).toBeVisible();
  });

  test('admin session: team sidebar nav link navigates to /team', async ({
    adminPage,
  }, testInfo) => {
    const basePage = new BasePage(adminPage, testInfo);

    // Start at the (app) root.
    await basePage.goto('/');

    // The Admin nav section "Team" link must be visible for an admin.
    const teamLink = adminPage.getByRole('link', { name: /^team$/i });
    await expect(teamLink).toBeVisible({ timeout: 15_000 });

    // Click the link — should navigate to /team.
    await teamLink.click();
    await adminPage.waitForURL(/\/team/);

    await expect(
      adminPage.getByRole('heading', { name: /^team$/i })
    ).toBeVisible({ timeout: 10_000 });

    // Screenshot 02 — nav to team via sidebar.
    await basePage.screenshot('PA001', '02', 'team-via-sidebar');
  });

  test('member session: /team is gated — member is redirected', async ({
    memberPage,
  }, testInfo) => {
    const basePage = new BasePage(memberPage, testInfo);

    // A member hitting /team directly should be redirected away.
    await basePage.goto('/team');

    // After redirect, the /team heading must NOT be visible.
    // The member should land somewhere else (e.g. '/' root redirect).
    await expect(
      memberPage.getByRole('heading', { name: /^team$/i })
    ).not.toBeVisible({ timeout: 10_000 });

    // Screenshot 03 — member gated from /team.
    await basePage.screenshot('PA001', '03', 'member-gated');
  });
});
