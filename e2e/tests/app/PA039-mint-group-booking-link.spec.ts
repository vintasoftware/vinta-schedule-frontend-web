import { test, expect } from '../../fixtures/auth';
import { GroupsPage } from '../../page-objects/groups-page';
import { PublicGroupBookingPage } from '../../page-objects/public-group-booking-page';
import { deleteCalendarGroup } from '../../fixtures/calendar-group-cleanup';

/**
 * PA039 — Admin mints a group scheduling link; an attendee books with it
 *
 * The full code-gated round trip:
 *   1. An admin session creates a calendar group at `/groups`, with one slot
 *      staffed by a real calendar (so the backend can return bookable slots)
 *      and a positive appointment length (required before ANY `book` link
 *      can be minted for a group target — see `MintBookingLinkDialog`'s
 *      `groupDurationIsUnset` guard — independent of whether the group is
 *      ever made publicly (codelessly) bookable).
 *   2. The admin mints a `book` scheduling link for that group from the
 *      group's row action and captures the URL from the dialog's one-time
 *      reveal — it is never shown again after the dialog closes.
 *   3. IN A FRESH, UNAUTHENTICATED BROWSER CONTEXT (no seeded token, no
 *      cookies — see the test body for why this is load-bearing), that URL
 *      is opened, a time is picked, a calendar is chosen for the slot, an
 *      attendee email is entered, and the booking is confirmed.
 *   4. The confirmation offers the self-service reschedule and cancel links.
 *
 * Prerequisite: `E2E_ADMIN_ACCESS_TOKEN` must be a valid JWT for an admin
 * account in the QA test org against the live API configured via
 * `NEXT_PUBLIC_API_BASE_URL`, and that org must have at least one real
 * calendar with actual availability configured on the live backend — if the
 * public slot picker ever renders empty, that is the most likely cause (see
 * the assertion below), not a UI defect.
 *
 * Cleanup: the group created here has no delete affordance anywhere in the
 * app UI (see `e2e/fixtures/calendar-group-cleanup.ts`), so `afterEach` (not
 * a `finally` inside the test) deletes it straight through the REST API —
 * `afterEach` still runs even if an assertion above throws mid-flow, so a
 * failed run doesn't leave the group behind.
 */

test.describe('PA039 — Admin mints a group booking link; an attendee books it', () => {
  let groupId: number | null = null;

  test.afterEach(async ({ request }) => {
    await deleteCalendarGroup(request, groupId);
    groupId = null;
  });

  test('admin mints a group booking link; an anonymous attendee books with it', async ({
    adminPage,
    browser,
  }, testInfo) => {
    const groupsPage = new GroupsPage(adminPage, testInfo);
    const groupName = `PA039 group ${Date.now()}`;

    await groupsPage.open();
    await expect(groupsPage.newGroupButton).toBeVisible({ timeout: 15_000 });

    // Step 1 — create the group. Duration is set (30 min) even though this
    // group is never made publicly bookable — a `book` link mint blocks on
    // an unset group duration regardless of `accepts_public_scheduling`.
    await groupsPage.createGroup({
      name: groupName,
      slotName: 'Availability',
      durationMinutes: 30,
    });
    await groupsPage.screenshot('PA039', '01', 'group-created');

    // Resolve the id now (for cleanup) and confirm the row rendered before
    // reaching for its row action.
    await groupsPage.searchFor(groupName);
    await expect(groupsPage.groupDetailLink(groupName)).toBeVisible({
      timeout: 15_000,
    });
    groupId = await groupsPage.getGroupId(groupName);

    // Step 2 — mint a `book` link from the row action and capture the
    // one-time reveal. Must happen in this same run; there is no way to
    // retrieve a minted code afterward.
    await groupsPage.getSchedulingLinkButton(groupName).click();
    await groupsPage.mintDialog.submit();
    const bookingUrl = await groupsPage.mintDialog.captureUrl();
    await groupsPage.screenshot('PA039', '02', 'link-minted');
    await groupsPage.mintDialog.close();

    // Step 3 — open the link in a FRESH, unauthenticated browser context.
    // Reusing `adminPage` here would prove nothing: the public route must
    // work with no session at all, and `adminPage`'s context carries a real
    // admin JWT in localStorage/cookies that would silently paper over a
    // page that (incorrectly) depended on one.
    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    const publicBookingPage = new PublicGroupBookingPage(
      anonymousPage,
      testInfo
    );

    try {
      await publicBookingPage.openUrl(bookingUrl);
      await expect(publicBookingPage.heading).toBeVisible({
        timeout: 15_000,
      });
      await publicBookingPage.screenshot('PA039', '03', 'public-slot-picker');

      await expect(
        publicBookingPage.slotPickerEmpty,
        'No bookable times were returned for this link. This usually means ' +
          "the group's calendar has no real availability configured on the " +
          'live backend, not a UI bug — configure availability for the QA ' +
          'org calendar this test used and re-run.'
      ).not.toBeVisible({ timeout: 15_000 });
      await publicBookingPage.selectFirstBookableTime();

      await expect(publicBookingPage.groupSlotSelection).toBeVisible({
        timeout: 15_000,
      });
      await publicBookingPage.screenshot('PA039', '04', 'group-slot-selection');
      await publicBookingPage.selectCalendarsForEachSlot();

      await expect(publicBookingPage.attendeeEmailInput).toBeVisible({
        timeout: 15_000,
      });
      await publicBookingPage.screenshot('PA039', '05', 'attendee-details');
      await publicBookingPage.submitAttendeeDetails(
        `qa+e2e-pa039-${Date.now()}@example.com`
      );

      // Booking confirmed, with self-service reschedule/cancel links.
      await expect(publicBookingPage.confirmation).toBeVisible({
        timeout: 15_000,
      });
      await expect(publicBookingPage.managementLinksCard).toBeVisible();
      await expect(publicBookingPage.rescheduleLinkInput).toHaveValue(/.+/);
      await expect(publicBookingPage.cancelLinkInput).toHaveValue(/.+/);
      await publicBookingPage.screenshot('PA039', '06', 'booking-confirmed');
    } finally {
      await anonymousContext.close();
    }
  });
});
