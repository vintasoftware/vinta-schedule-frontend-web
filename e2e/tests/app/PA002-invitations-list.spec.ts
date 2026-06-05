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
 *   5. After load, either pending invitation rows OR the empty state message
 *      is visible — both are explicitly asserted (no silent pass-through).
 *   6. A member session is redirected away from `/team` (gated).
 *
 * Prerequisite: `E2E_ADMIN_ACCESS_TOKEN` must be set to a valid JWT for an
 * admin account in the QA test org against the live API configured via
 * `NEXT_PUBLIC_API_BASE_URL`.
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

  test('admin session: clicking Invitations tab shows the pending invitations table structure', async ({
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

    // The table headers must appear — these are structural and always present
    // regardless of whether there are rows or not.
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

    // Screenshot 02 — Invitations tab is active and table structure is visible.
    await basePage.screenshot('PA002', '02', 'invitations-tab-active');
  });

  test('admin session: Invitations tab shows populated rows OR empty state (never skeletons)', async ({
    adminPage,
  }, testInfo) => {
    const basePage = new BasePage(adminPage, testInfo);

    // Navigate to the team page.
    await basePage.goto('/team');

    await expect(
      adminPage.getByRole('heading', { name: /^team$/i })
    ).toBeVisible({ timeout: 15_000 });

    // Click the Invitations tab.
    await adminPage.getByRole('tab', { name: /^invitations$/i }).click();

    // Wait for the table structure to render (columns visible = skeleton phase is over).
    await expect(
      adminPage.getByRole('columnheader', { name: /email/i })
    ).toBeVisible({ timeout: 10_000 });

    // Wait for skeleton rows to disappear (API call resolved).
    // Skeleton rows carry aria-hidden="true"; once gone the table is fully loaded.
    await expect(
      adminPage.locator('tr[aria-hidden="true"]').first()
    ).not.toBeVisible({ timeout: 15_000 });

    // --- Deterministic assertion: EITHER rows OR empty state must be present. ---
    // We check for the empty-state message first (fast negative test).
    const emptyMsg = adminPage.getByText(/no pending invitations/i);
    const emptyMsgVisible = await emptyMsg.isVisible();

    if (emptyMsgVisible) {
      // Step A — empty state: the message is shown and no data rows exist.
      await expect(emptyMsg).toBeVisible();
      const dataRows = adminPage.locator('table tbody tr:not([aria-hidden])');
      expect(await dataRows.count()).toBe(0);

      // Screenshot 03 — empty state.
      await basePage.screenshot('PA002', '03', 'invitations-list-empty');
    } else {
      // Step B — populated state: at least one data row is visible with the
      // expected columns (email cell, expiry cell, pending badge).
      const firstDataRow = adminPage.locator('table tbody tr').first();
      await expect(firstDataRow).toBeVisible();

      // The first cell of the first row must be a non-empty email address.
      const emailCell = firstDataRow.locator('td').first();
      const emailText = await emailCell.textContent();
      expect(emailText).toBeTruthy();
      expect(emailText!.trim().length).toBeGreaterThan(0);

      // At least one "pending" status badge must be visible.
      await expect(adminPage.getByText(/^pending$/).first()).toBeVisible();

      // Screenshot 04 — populated state.
      await basePage.screenshot('PA002', '04', 'invitations-list-populated');
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
