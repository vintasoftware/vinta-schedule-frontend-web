import type { Browser, TestInfo } from '@playwright/test';
import { test, expect } from '../../fixtures/auth';
import { AppointmentTypesPage } from '../../page-objects/appointment-types-page';
import { AppointmentTypeDetailPage } from '../../page-objects/appointment-type-detail-page';
import { PublicAppointmentTypeBookingPage } from '../../page-objects/public-appointment-type-booking-page';
import { deleteAppointmentType } from '../../fixtures/appointment-type-cleanup';

/**
 * PA040 — Admin makes an appointment type publicly bookable; the reusable link books
 * more than once
 *
 *   1. An admin session creates an appointment type at `/appointment types`, with one slot
 *      staffed by a real calendar (so the backend can return bookable
 *      slots) but NO duration yet — this is created privately first so the
 *      test actually exercises the `PublicSchedulingSettings` form on the
 *      appointment type detail view, not the create dialog's own (separate) public-
 *      scheduling toggle.
 *   2. On `/appointment types/[id]`, the admin sets an appointment length and turns on
 *      "Accept public bookings" — an appointment type with no duration cannot be made
 *      public at all (the form blocks it), which is why step 1 leaves
 *      duration for this step to set.
 *   3. The admin copies the reusable public link the settings card surfaces.
 *   4. IN A FRESH, UNAUTHENTICATED BROWSER CONTEXT, that link books an
 *      appointment successfully.
 *   5. THROUGH ANOTHER FRESH, UNAUTHENTICATED CONTEXT, the SAME link books a
 *      SECOND appointment successfully — the property that distinguishes a
 *      codeless reusable link from every code-gated one in this feature: a
 *      single-use code would have been consumed by the first booking.
 *
 * Prerequisite: `E2E_ADMIN_ACCESS_TOKEN` must be a valid JWT for an admin
 * account in the QA test org against the live API configured via
 * `NEXT_PUBLIC_API_BASE_URL`, and that org's calendar must have at least two
 * distinct bookable times available on the live backend (one per booking in
 * this spec) — if the public slot picker ever renders empty, that is the
 * most likely cause (see the assertions below), not a UI defect.
 *
 * Cleanup: same as PA039 — no delete affordance in the UI, so `afterEach`
 * deletes the appointment type straight through the REST API regardless of whether the
 * test above it passed or threw mid-flow.
 */

test.describe('PA040 — Admin makes an appointment type publicly bookable via a reusable link', () => {
  let appointmentTypeId: number | null = null;

  test.afterEach(async ({ request }) => {
    await deleteAppointmentType(request, appointmentTypeId);
    appointmentTypeId = null;
  });

  test('the reusable public link books twice through two separate anonymous contexts', async ({
    adminPage,
    browser,
  }, testInfo) => {
    const appointmentTypesPage = new AppointmentTypesPage(adminPage, testInfo);
    const appointmentTypeName = `PA040 appointment type ${Date.now()}`;

    await appointmentTypesPage.open();
    await expect(appointmentTypesPage.newAppointmentTypeButton).toBeVisible({
      timeout: 15_000,
    });

    // Step 1 — create the appointment type WITHOUT a duration; the detail-view settings
    // form (step 2) is what this spec is meant to exercise.
    await appointmentTypesPage.createAppointmentType({
      name: appointmentTypeName,
      slotName: 'Availability',
    });
    await appointmentTypesPage.screenshot(
      'PA040',
      '01',
      'appointment-type-created'
    );

    await appointmentTypesPage.searchFor(appointmentTypeName);
    await expect(
      appointmentTypesPage.appointmentTypeDetailLink(appointmentTypeName)
    ).toBeVisible({
      timeout: 15_000,
    });
    appointmentTypeId =
      await appointmentTypesPage.getAppointmentTypeId(appointmentTypeName);

    // Step 2 — navigate to the detail view and turn on public scheduling
    // with a 30-minute appointment length.
    await appointmentTypesPage
      .appointmentTypeDetailLink(appointmentTypeName)
      .click();
    const appointmentTypeDetailPage = new AppointmentTypeDetailPage(
      adminPage,
      testInfo
    );
    await expect(
      appointmentTypeDetailPage.acceptPublicBookingsSwitch
    ).toBeVisible({
      timeout: 15_000,
    });
    await appointmentTypeDetailPage.screenshot(
      'PA040',
      '02',
      'public-scheduling-settings-before'
    );

    await appointmentTypeDetailPage.enablePublicScheduling(30);

    // No `<Toaster/>` is mounted in this app — the real confirmation that
    // the PATCH succeeded is the settings card's own state: once the appointment type
    // query refetches with `accepts_public_scheduling: true`, the "this
    // link won't work yet" notice on the link card disappears.
    await expect(
      appointmentTypeDetailPage.publicAppointmentTypeLinkInactiveToggleNotice
    ).not.toBeVisible({ timeout: 15_000 });
    await appointmentTypeDetailPage.screenshot(
      'PA040',
      '03',
      'public-scheduling-enabled'
    );

    // Step 3 — copy the reusable public link.
    const publicUrl = await appointmentTypeDetailPage.capturePublicBookingUrl();

    // Steps 4 & 5 — book through the SAME link from two separate,
    // unauthenticated contexts, one after the other. Reusing `adminPage`
    // for either would prove nothing about the codeless route's session
    // independence — see PA039's identical note on this.
    await bookThroughPublicLink(browser, publicUrl, testInfo, {
      idSuffix: 'first',
      screenshotStep: '04',
    });
    await bookThroughPublicLink(browser, publicUrl, testInfo, {
      idSuffix: 'second',
      screenshotStep: '05',
    });
  });
});

/**
 * Opens `publicUrl` in a brand-new browser context (no storage state at
 * all), completes one booking end to end, and asserts it confirmed —
 * proving the link is reusable when called twice with different
 * `idSuffix`/`screenshotStep` values from the same test.
 */
async function bookThroughPublicLink(
  browser: Browser,
  publicUrl: string,
  testInfo: TestInfo,
  { idSuffix, screenshotStep }: { idSuffix: string; screenshotStep: string }
): Promise<void> {
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();
  const publicBookingPage = new PublicAppointmentTypeBookingPage(
    anonymousPage,
    testInfo
  );

  try {
    await publicBookingPage.openUrl(publicUrl);
    await expect(publicBookingPage.heading).toBeVisible({ timeout: 15_000 });

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
      'PA040',
      screenshotStep,
      `${idSuffix}-booking-slot-selection`
    );
    await publicBookingPage.selectCalendarsForEachSlot();

    await expect(publicBookingPage.attendeeEmailInput).toBeVisible({
      timeout: 15_000,
    });
    await publicBookingPage.submitAttendeeDetails(
      `qa+e2e-pa040-${idSuffix}-${Date.now()}@example.com`
    );

    await expect(publicBookingPage.confirmation).toBeVisible({
      timeout: 15_000,
    });
    await publicBookingPage.screenshot(
      'PA040',
      `${screenshotStep}b`,
      `${idSuffix}-booking-confirmed`
    );
  } finally {
    await anonymousContext.close();
  }
}
