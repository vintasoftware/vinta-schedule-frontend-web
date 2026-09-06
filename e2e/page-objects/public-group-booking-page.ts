import type { Page, TestInfo } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * Page object for the public, UNAUTHENTICATED calendar-group booking flow.
 *
 * One page object covers both variants, since they render the exact same
 * component tree (`SlotPicker` → `GroupSlotSelection` → `AttendeeForm` →
 * `BookingConfirmation`):
 *   - the code-gated flow at `/book/[code]` (and its branded
 *     `/o/[slug]/book/[code]` twin), `PublicGroupBookingFlow` — PA039;
 *   - the reusable, codeless flow at `/g/[public_slug]` (and its branded
 *     `/o/[slug]/g/[public_slug]` twin), `CodelessGroupBookingFlow` — PA040.
 *
 * Deliberately does NOT extend `memberPage`/`adminPage` — every spec that
 * uses this page object must open it in a session-free
 * `browser.newContext()` (see the specs' own doc comments for why that
 * matters here specifically).
 */
export class PublicGroupBookingPage extends BasePage {
  constructor(page: Page, testInfo: TestInfo) {
    super(page, testInfo);
  }

  /**
   * Navigate to an absolute booking URL captured from a mint dialog or a
   * group's public-scheduling settings. Always absolute — these links embed
   * their own origin (`buildBookingLinkUrl`/`buildGroupPublicBookingUrl` both
   * build off `window.location.origin` at mint time) — so this bypasses
   * `BasePage.goto`'s baseURL-relative convention on purpose.
   */
  async openUrl(url: string): Promise<void> {
    await this.page.goto(url);
    await this.page.waitForLoadState('networkidle');
  }

  get heading() {
    return this.page.getByRole('heading', { name: /book an appointment/i });
  }

  // ---------------------------------------------------------------------
  // Step 1 — pick a time (`slot-picker.tsx`)
  // ---------------------------------------------------------------------

  get slotPickerTimes() {
    return this.page.getByTestId('slot-picker-times');
  }

  /** Rendered instead of a time list when the read returned zero proposals —
   * almost always an environment precondition (no calendar availability on
   * the live backend), not a UI defect. Assert on this explicitly in specs
   * rather than letting the next step time out unexplained. */
  get slotPickerEmpty() {
    return this.page.getByTestId('slot-picker-empty');
  }

  /** The day grid already defaults its selection to the first day that has
   * a bookable time (`SlotPickerCalendar`'s `selectedDay` initializer), so
   * picking a time never requires a calendar-grid click first. */
  async selectFirstBookableTime(): Promise<void> {
    const firstTime = this.slotPickerTimes.getByRole('radio').first();
    await firstTime.waitFor({ state: 'visible', timeout: 15_000 });
    await firstTime.click();
  }

  // ---------------------------------------------------------------------
  // Step 2 — choose calendars per slot (`group-slot-selection.tsx`)
  // ---------------------------------------------------------------------

  get groupSlotSelection() {
    return this.page.getByTestId('group-slot-selection');
  }

  /** A FREE candidate's accessible name is exactly `Option N`; a busy one
   * gets a ` (unavailable)` suffix and is disabled — so this regex only ever
   * matches a selectable option. Every group this suite builds has exactly
   * one slot with `required_count: 1` and a single-calendar roster, so
   * picking the first match is always sufficient — this isn't a generic
   * "satisfy every slot" helper. */
  get firstAvailableGroupSlotOption() {
    return this.page.getByRole('checkbox', { name: /^Option \d+$/ }).first();
  }

  get groupSlotSelectionContinueButton() {
    return this.page.getByTestId('group-slot-selection-continue');
  }

  async selectCalendarsForEachSlot(): Promise<void> {
    await this.firstAvailableGroupSlotOption.waitFor({
      state: 'visible',
      timeout: 15_000,
    });
    await this.firstAvailableGroupSlotOption.click();
    await this.groupSlotSelectionContinueButton.click();
  }

  // ---------------------------------------------------------------------
  // Step 3 — attendee details (`attendee-form.tsx`)
  // ---------------------------------------------------------------------

  get attendeeEmailInput() {
    return this.page.getByTestId('attendee-email-input');
  }

  get attendeeSubmitButton() {
    return this.page.getByTestId('attendee-form-submit');
  }

  async submitAttendeeDetails(email: string): Promise<void> {
    await this.attendeeEmailInput.fill(email);
    await this.attendeeSubmitButton.click();
  }

  // ---------------------------------------------------------------------
  // Terminal states
  // ---------------------------------------------------------------------

  get confirmation() {
    return this.page.getByTestId('booking-confirmation');
  }

  get managementLinksCard() {
    return this.page.getByTestId('booking-management-links');
  }

  get rescheduleLinkInput() {
    return this.page.getByTestId('reschedule-link-input');
  }

  get cancelLinkInput() {
    return this.page.getByTestId('cancel-link-input');
  }
}
