import type { Page } from '@playwright/test';

/**
 * MintBookingLinkDialogPart — locators/actions for the one-time-reveal
 * `MintBookingLinkDialog` (`@/components/booking-links/mint-booking-link-dialog.tsx`).
 *
 * Not a `BasePage` subclass: it isn't a screen of its own, it's a dialog that
 * mounts inside whichever page opened it (`GroupsPage`'s row action, or
 * `GroupDetailPage`'s "Get scheduling link" button) — both expose a
 * `mintDialog` getter that hands back an instance of this class bound to
 * their own `page`, so the interaction is written once.
 *
 * The plaintext code embedded in the revealed URL is a single-use credential
 * shown exactly once (see the component's own SECURITY doc comment) — capture
 * it via `captureUrl()` immediately; there is no way to recover it once the
 * dialog closes.
 */
export class MintBookingLinkDialogPart {
  constructor(private readonly page: Page) {}

  get submitButton() {
    return this.page.getByTestId('create-booking-link-submit');
  }

  get urlInput() {
    return this.page.getByTestId('booking-link-url-input');
  }

  get doneButton() {
    return this.page.getByTestId('done-button');
  }

  get groupDurationRequiredNotice() {
    return this.page.getByTestId('group-duration-required-notice');
  }

  /** Submits the mint form (default expiry: never; default duration, when
   * the target needs one, is pre-filled by the dialog itself). */
  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  /**
   * Reads the minted, one-time-reveal URL from the dialog's plaintext input.
   * Must be called before `close()` — the dialog clears its local state (and
   * the code is never re-derivable) once it closes.
   */
  async captureUrl(): Promise<string> {
    await this.urlInput.waitFor({ state: 'visible', timeout: 15_000 });
    const url = await this.urlInput.inputValue();
    if (!url) {
      throw new Error(
        'Minted booking link input was empty — the one-time reveal did not render a URL.'
      );
    }
    return url;
  }

  async close(): Promise<void> {
    await this.doneButton.click();
  }
}
