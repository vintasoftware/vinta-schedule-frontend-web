import type { Page, TestInfo } from '@playwright/test';
import { BasePage } from './base-page';
import { MintBookingLinkDialogPart } from './mint-booking-link-dialog';

/**
 * Page object for the calendar groups list at `/groups`
 * (`@/components/calendar-groups/groups-table.tsx`).
 *
 * Covers the admin-only create flow (`GroupFormDialog` in create mode) and
 * the per-row "Get scheduling link" action, which mounts the shared
 * `MintBookingLinkDialog` — exposed here as `mintDialog`
 * (`MintBookingLinkDialogPart`) since it renders inside this same page.
 */
export class GroupsPage extends BasePage {
  constructor(page: Page, testInfo: TestInfo) {
    super(page, testInfo);
  }

  async open(): Promise<void> {
    await this.goto('/groups');
  }

  get newGroupButton() {
    return this.page.getByTestId('new-group-button');
  }

  get groupNameInput() {
    return this.page.getByLabel('Group name');
  }

  get slotNameInput() {
    return this.page.getByLabel('Slot name');
  }

  get durationMinutesInput() {
    return this.page.getByLabel('Appointment length in minutes');
  }

  get individualCalendarsCombobox() {
    return this.page.getByRole('combobox', { name: /individual calendars/i });
  }

  get createSubmitButton() {
    return this.page.getByTestId('create-group-submit');
  }

  get searchInput() {
    return this.page.getByRole('textbox', { name: 'Search' });
  }

  /**
   * Opens the create dialog and builds the minimum viable group: one slot
   * named `slotName`, with the FIRST calendar the "Individual calendars"
   * combobox lists (whichever real calendar the QA org happens to have —
   * see the file-level environment-precondition note in the specs that call
   * this). A `durationMinutes` above 0 is required before a `book` link can
   * be minted for a GROUP target at all (`MintBookingLinkDialog` blocks on
   * `groupDurationIsUnset`), independent of whether public scheduling is
   * ever turned on — so callers that intend to mint a link must pass one
   * greater than zero even if they never flip "Accept public bookings".
   *
   * Resolves once the create dialog has closed (its submit button detaches).
   */
  async createGroup({
    name,
    slotName,
    durationMinutes = 0,
  }: {
    name: string;
    slotName: string;
    durationMinutes?: number;
  }): Promise<void> {
    await this.newGroupButton.click();
    await this.groupNameInput.fill(name);
    await this.slotNameInput.fill(slotName);

    if (durationMinutes > 0) {
      await this.durationMinutesInput.fill(String(durationMinutes));
    }

    await this.individualCalendarsCombobox.click();
    const noCalendarsEmptyState = this.page.getByText('No calendars found.');
    const firstCalendarOption = this.page.getByRole('option').first();
    // Fail with a message naming the likely cause (no calendars in the QA
    // org) rather than a bare timeout on the option click below.
    await Promise.race([
      firstCalendarOption.waitFor({ state: 'visible', timeout: 15_000 }),
      noCalendarsEmptyState
        .waitFor({ state: 'visible', timeout: 15_000 })
        .then(() => {
          throw new Error(
            'The "Individual calendars" picker listed no calendars for this ' +
              'org. This is an environment precondition, not a UI bug — the ' +
              'QA org needs at least one real calendar for this group to have ' +
              'bookable slots.'
          );
        }),
    ]);
    await firstCalendarOption.click();
    // Close the popover (Escape dismisses only the topmost Radix layer, not
    // the outer create dialog) so the rest of the form is interactable —
    // same convention as `create-group-dialog.test.tsx`'s `pickInCombobox`.
    await this.page.keyboard.press('Escape');

    await this.createSubmitButton.click();
    await this.createSubmitButton.waitFor({ state: 'hidden', timeout: 15_000 });
  }

  getSchedulingLinkButton(groupName: string) {
    return this.page.getByRole('button', {
      name: `Get scheduling link for ${groupName}`,
    });
  }

  groupDetailLink(groupName: string) {
    return this.page.getByRole('link', { name: groupName });
  }

  /** Resolves the numeric id `/groups/[id]` routes on, off the name cell's
   * `href` — used both to navigate to the detail view and to clean the
   * group up afterward via the API (there is no delete affordance in the
   * UI at all; see `e2e/fixtures/calendar-group-cleanup.ts`). */
  async getGroupId(groupName: string): Promise<number> {
    const href = await this.groupDetailLink(groupName).getAttribute('href');
    const match = href?.match(/\/groups\/(\d+)/);
    if (!match) {
      throw new Error(
        `Could not resolve a group id from href "${href}" for group "${groupName}"`
      );
    }
    return Number(match[1]);
  }

  /** Searches the table for `name` — used to locate a just-created group
   * regardless of which page/sort order the list would otherwise land it on. */
  async searchFor(name: string): Promise<void> {
    await this.searchInput.fill(name);
  }

  get mintDialog(): MintBookingLinkDialogPart {
    return new MintBookingLinkDialogPart(this.page);
  }
}
