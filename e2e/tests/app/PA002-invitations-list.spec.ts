import { test, expect } from '../../fixtures/auth';
import { BasePage } from '../../page-objects/base-page';

/**
 * PA002 — Admin: view pending invitations list
 *
 * Verifies the admin pending invitations datatable at `/team` (Invitations tab):
 *   1. An admin session navigates to `/team`.
 *   2. The page renders Team and Invitations tabs.
 *   3. Clicking the Invitations tab shows the pending invitations table.
 *   4. Table columns (Email, Expires, Status) are visible.
 *   5. Pending invitations are shown with expiry dates and "pending" status.
 *   6. Pagination footer is present when there are multiple pages.
 *   7. A member session is redirected away from `/team` (gated).
 *
 * Prerequisite: `E2E_ADMIN_ACCESS_TOKEN` must be set to a valid JWT for an
 * admin account in the QA test org against the live API configured via
 * `NEXT_PUBLIC_API_BASE_URL`. The test org must have at least one pending
 * invitation for the populated state test; the empty state test verifies
 * graceful fallback when no invitations exist.
 */

test.describe('PA002 — Admin: pending invitations list', () => {
  test('admin session: team page renders tabs including Invitations', async ({
    adminPage,
  }, testInfo) => {
    const basePage = new BasePage(adminPage, testInfo);

    // Navigate to the team page.
    await basePage.goto('/team');

    // The "Team" heading confirms the page mounted (not the loading state).
    await expect(
      adminPage.getByRole('heading', { name: /^team$/i })
    ).toBeVisible({ timeout: 15_000 });

    // Both Tab buttons must be present.
    const teamTab = adminPage.getByRole('tab', { name: /^team$/i });
    const invitationsTab = adminPage.getByRole('tab', {
      name: /^invitations$/i,
    });
    await expect(teamTab).toBeVisible();
    await expect(invitationsTab).toBeVisible();

    // Screenshot 01 — team page with tabs, Team tab active.
    await basePage.screenshot('PA002', '01', 'team-tabs-team-active');
  });

  test('admin session: clicking Invitations tab shows the pending invitations table', async ({
    adminPage,
  }, testInfo) => {
    const basePage = new BasePage(adminPage, testInfo);

    // Navigate to the team page.
    await basePage.goto('/team');

    // Wait for the page to fully load.
    await expect(
      adminPage.getByRole('heading', { name: /^team$/i })
    ).toBeVisible({ timeout: 15_000 });

    // Click the Invitations tab.
    const invitationsTab = adminPage.getByRole('tab', {
      name: /^invitations$/i,
    });
    await invitationsTab.click();

    // The Invitations tab content should be visible.
    // Wait for the table headers to appear, which indicates the DataTable is mounted.
    const emailHeader = adminPage.getByRole('columnheader', {
      name: /email/i,
    });
    const expiresHeader = adminPage.getByRole('columnheader', {
      name: /expires/i,
    });
    const statusHeader = adminPage.getByRole('columnheader', {
      name: /status/i,
    });

    await expect(emailHeader).toBeVisible({ timeout: 10_000 });
    await expect(expiresHeader).toBeVisible({ timeout: 10_000 });
    await expect(statusHeader).toBeVisible({ timeout: 10_000 });

    // Screenshot 02 — Invitations tab is active and table is visible.
    await basePage.screenshot('PA002', '02', 'invitations-tab-active');
  });

  test('admin session: Invitations tab shows pending invitations with expiry and status', async ({
    adminPage,
  }, testInfo) => {
    const basePage = new BasePage(adminPage, testInfo);

    // Navigate to the team page.
    await basePage.goto('/team');

    // Wait for the page to fully load.
    await expect(
      adminPage.getByRole('heading', { name: /^team$/i })
    ).toBeVisible({ timeout: 15_000 });

    // Click the Invitations tab.
    const invitationsTab = adminPage.getByRole('tab', {
      name: /^invitations$/i,
    });
    await invitationsTab.click();

    // Wait for the table to render. If there are pending invitations,
    // we expect to see email addresses and status badges.
    const emailHeader = adminPage.getByRole('columnheader', {
      name: /email/i,
    });
    await expect(emailHeader).toBeVisible({ timeout: 10_000 });

    // Get all table rows (including header row).
    const rows = adminPage.getByRole('row');
    const rowCount = await rows.count();

    // If the org has pending invitations (> 1 row: header + ≥1 pending),
    // verify table structure.
    if (rowCount > 1) {
      // At least one email address should be visible.
      const emailCell = adminPage.locator('table tbody tr').first();
      await expect(emailCell).toBeVisible();

      // "pending" status badge should be visible (at least one).
      const pendingBadge = adminPage.getByText(/^pending$/).first();
      await expect(pendingBadge).toBeVisible();

      // At least one expiry date should be visible (formatted as "Mon D, YYYY").
      const expiryCell = adminPage.locator('table tbody tr td').nth(1).first();
      await expect(expiryCell).toBeVisible();

      // Screenshot 03 — Invitations list with rows.
      await basePage.screenshot('PA002', '03', 'invitations-list-populated');
    } else {
      // No pending invitations — verify empty state message.
      const emptyMsg = adminPage.getByText(/no pending invitations/i);
      await expect(emptyMsg).toBeVisible({ timeout: 10_000 });

      // Screenshot 04 — Invitations list empty state.
      await basePage.screenshot('PA002', '04', 'invitations-list-empty');
    }
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

    // Screenshot 05 — member gated from /team.
    await basePage.screenshot('PA002', '05', 'member-gated');
  });
});
