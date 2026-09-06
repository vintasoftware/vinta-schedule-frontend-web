import type { Page, TestInfo } from '@playwright/test';
import { BasePage } from './base-page';
import { MintBookingLinkDialogPart } from './mint-booking-link-dialog';

/**
 * Page object for the appointment type detail screen at `/appointment types/[id]`
 * (`@/components/appointment-types/appointment-type-detail-view.tsx`), covering the
 * `PublicSchedulingSettings` card (the appointment type's public-scheduling toggle,
 * appointment length, and its stable, reusable `public_booking_slug` link)
 * plus the detail view's own "Get scheduling link" action, which mounts the
 * same `MintBookingLinkDialog` the appointment types list does — exposed here as
 * `mintDialog` for parity with `AppointmentTypesPage`.
 */
export class AppointmentTypeDetailPage extends BasePage {
  constructor(page: Page, testInfo: TestInfo) {
    super(page, testInfo);
  }

  async openById(id: number | string): Promise<void> {
    await this.goto(`/appointment-types/${id}`);
  }

  get heading() {
    return this.page.getByRole('heading', { level: 1 });
  }

  get acceptPublicBookingsSwitch() {
    return this.page.getByRole('switch', { name: 'Accept public bookings' });
  }

  get appointmentLengthInput() {
    return this.page.getByRole('spinbutton', {
      name: 'Appointment length in minutes',
    });
  }

  get savePublicSchedulingButton() {
    return this.page.getByTestId('save-public-scheduling-settings');
  }

  get publicAppointmentTypeLinkInput() {
    return this.page.getByTestId('public-appointment-type-link-input');
  }

  get publicAppointmentTypeLinkInactiveToggleNotice() {
    return this.page.getByTestId(
      'public-appointment-type-link-inactive-toggle'
    );
  }

  /**
   * Sets the appointment length and turns "Accept public bookings" on, then
   * saves — a single `PATCH` carrying both fields
   * (`public-scheduling-settings.tsx`). Idempotent: only clicks the switch
   * when it isn't already checked, so calling this twice on an
   * already-public appointment type doesn't accidentally toggle it back off.
   */
  async enablePublicScheduling(durationMinutes: number): Promise<void> {
    await this.appointmentLengthInput.fill(String(durationMinutes));
    const isChecked =
      (await this.acceptPublicBookingsSwitch.getAttribute('aria-checked')) ===
      'true';
    if (!isChecked) {
      await this.acceptPublicBookingsSwitch.click();
    }
    await this.savePublicSchedulingButton.click();
  }

  /**
   * Reads the appointment type's stable, reusable public booking link. UNLIKE a minted
   * booking code, this is never a one-time reveal — it is safe to read any
   * number of times (see `public-scheduling-settings.tsx`'s "PHASE 7" doc
   * comment) — so, unlike `MintBookingLinkDialogPart.captureUrl()`, calling
   * this more than once is fine.
   */
  async capturePublicBookingUrl(): Promise<string> {
    const url = await this.publicAppointmentTypeLinkInput.inputValue();
    if (!url) {
      throw new Error(
        'Public appointment type booking link input was empty — the settings card did ' +
          'not render a URL.'
      );
    }
    return url;
  }

  get mintDialog(): MintBookingLinkDialogPart {
    return new MintBookingLinkDialogPart(this.page);
  }
}
