import { test, expect } from '../../fixtures/auth';
import { AppointmentTypesPage } from '../../page-objects/appointment-types-page';
import { PublicAppointmentTypeBookingPage } from '../../page-objects/public-appointment-type-booking-page';
import { deleteAppointmentType } from '../../fixtures/appointment-type-cleanup';

/**
 * PA039 — Admin mints an appointment type scheduling link; an attendee books with it
 *
 * The full code-gated round trip:
 *   1. An admin session creates an appointment type at `/appointment types`, with one slot
 *      staffed by a real calendar (so the backend can return bookable slots)
 *      and a positive appointment length (required before ANY `book` link
 *      can be minted for an appointment type target — see `MintBookingLinkDialog`'s
 *      `appointmentTypeDurationIsUnset` guard — independent of whether the appointment type is
 *      ever made publicly (codelessly) bookable).
 *   2. The admin mints a `book` scheduling link for that appointment type from the
 *      appointment type's row action and captures the URL from the dialog's one-time
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
 * Cleanup: the appointment type created here has no delete affordance anywhere in the
 * app UI (see `e2e/fixtures/appointment-type-cleanup.ts`), so `afterEach` (not
 * a `finally` inside the test) deletes it straight through the REST API —
 * `afterEach` still runs even if an assertion above throws mid-flow, so a
 * failed run doesn't leave the appointment type behind.
 */

test.describe('PA039 — Admin mints an appointment type booking link; an attendee books it', () => {
  let appointmentTypeId: number | null = null;

  test.afterEach(async ({ request }) => {
    await deleteAppointmentType(request, appointmentTypeId);
    appointmentTypeId = null;
  });

  test('admin mints an appointment type booking link; an anonymous attendee books with it', async ({
    adminPage,
    browser,
  }, testInfo) => {
    const appointmentTypesPage = new AppointmentTypesPage(adminPage, testInfo);
    const appointmentTypeName = `PA039 appointment type ${Date.now()}`;

    await appointmentTypesPage.open();
    await expect(appointmentTypesPage.newAppointmentTypeButton).toBeVisible({
      timeout: 15_000,
    });

    // Step 1 — create the appointment type. Duration is set (30 min) even though this
    // appointment type is never made publicly bookable — a `book` link mint blocks on
    // an unset appointment type duration regardless of `accepts_public_scheduling`.
    await appointmentTypesPage.createAppointmentType({
      name: appointmentTypeName,
      slotName: 'Availability',
      durationMinutes: 30,
    });
    await appointmentTypesPage.screenshot(
      'PA039',
      '01',
      'appointment-type-created'
    );

    // Resolve the id now (for cleanup) and confirm the row rendered before
    // reaching for its row action.
    await appointmentTypesPage.searchFor(appointmentTypeName);
    await expect(
      appointmentTypesPage.appointmentTypeDetailLink(appointmentTypeName)
    ).toBeVisible({
      timeout: 15_000,
    });
    appointmentTypeId =
      await appointmentTypesPage.getAppointmentTypeId(appointmentTypeName);

    // Step 2 — mint a `book` link from the row action and capture the
    // one-time reveal. Must happen in this same run; there is no way to
    // retrieve a minted code afterward.
    await appointmentTypesPage
      .getSchedulingLinkButton(appointmentTypeName)
      .click();
    await appointmentTypesPage.mintDialog.submit();
    const bookingUrl = await appointmentTypesPage.mintDialog.captureUrl();
    await appointmentTypesPage.screenshot('PA039', '02', 'link-minted');
    await appointmentTypesPage.mintDialog.close();

    // Step 3 — open the link in a FRESH, unauthenticated browser context.
    // Reusing `adminPage` here would prove nothing: the public route must
    // work with no session at all, and `adminPage`'s context carries a real
    // admin JWT in localStorage/cookies that would silently paper over a
    // page that (incorrectly) depended on one.
    const anonymousContext = await browser.newContext();
    const anonymousPage = await anonymousContext.newPage();
    const publicBookingPage = new PublicAppointmentTypeBookingPage(
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
          "the appointment type's calendar has no real availability configured on the " +
          'live backend, not a UI bug — configure availability for the QA ' +
          'org calendar this test used and re-run.'
      ).not.toBeVisible({ timeout: 15_000 });
      await publicBookingPage.selectFirstBookableTime();

      await expect(publicBookingPage.appointmentTypeSlotSelection).toBeVisible({
        timeout: 15_000,
      });
      await publicBookingPage.screenshot(
        'PA039',
        '04',
        'appointment-type-slot-selection'
      );
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
