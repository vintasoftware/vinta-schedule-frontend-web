/**
 * MintBookingLinkDialog tests.
 *
 * Covers:
 * - Minting a calendar link surfaces the URL with `?duration=` when a
 *   nonzero duration was chosen, and without it when left at 0.
 * - Minting a group link surfaces a URL with no `?duration=` and no duration
 *   control is offered.
 * - The one-time reveal: the link is shown exactly once and is gone (DOM +
 *   mutation cache) after the dialog closes.
 * - Revoke calls `bookingCodesDestroy` with the minted id and moves the
 *   dialog into the revoked state.
 * - A failed mint reveals nothing.
 * - The plaintext code never reaches `console.log`.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// jsdom polyfills for Radix (Dialog)
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
  if (!global.ResizeObserver) {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE any imports that use them
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    bookingCodesCreate: vi.fn(),
    bookingCodesDestroy: vi.fn(),
  };
});

vi.mock('@/hooks/organizations/use-current-organization');

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import { bookingCodesCreate, bookingCodesDestroy } from '@/client/sdk.gen';
import * as orgHook from '@/hooks/organizations/use-current-organization';
import type { BookingCodeCreateResult } from '@/client';
import {
  MintBookingLinkDialog,
  type MintBookingLinkTarget,
} from './mint-booking-link-dialog';

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------

const ONE_TIME_CODE = 'plaintext-booking-code-once-only';

function mockOrgSlug(slug: string | undefined) {
  vi.mocked(orgHook.useCurrentOrganization).mockReturnValue({
    organization: slug ? { slug } : null,
    isOnboarded: true,
    isGated: false,
    isDisabled: false,
    membership: null,
    permissions: [],
    isLoading: false,
    isError: false,
    error: null,
    query: { data: undefined },
  } as unknown as ReturnType<typeof orgHook.useCurrentOrganization>);
}

function makeMintResult(
  overrides: Partial<BookingCodeCreateResult> = {}
): BookingCodeCreateResult {
  return {
    id: 1,
    code: ONE_TIME_CODE,
    purpose: 'book',
    calendar: null,
    calendar_group: null,
    event: null,
    expires_at: null,
    ...overrides,
  };
}

function makeMintResponse(
  result: BookingCodeCreateResult
): Awaited<ReturnType<typeof bookingCodesCreate>> {
  return {
    data: result,
    response: new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof bookingCodesCreate>>;
}

function makeDestroyResponse(): Awaited<
  ReturnType<typeof bookingCodesDestroy>
> {
  return {
    data: undefined,
    response: new Response(null, { status: 204 }),
  } as unknown as Awaited<ReturnType<typeof bookingCodesDestroy>>;
}

const CALENDAR_TARGET: MintBookingLinkTarget = {
  kind: 'calendar',
  id: 5,
  name: 'Dr. Smith',
};

const GROUP_TARGET: MintBookingLinkTarget = {
  kind: 'group',
  id: 9,
  name: 'Surgery Team',
  duration: '0:30:00',
};

const GROUP_TARGET_NO_DURATION: MintBookingLinkTarget = {
  kind: 'group',
  id: 10,
  name: 'Unconfigured Team',
  duration: undefined,
};

const GROUP_TARGET_ZERO_DURATION: MintBookingLinkTarget = {
  kind: 'group',
  id: 11,
  name: 'Zeroed Team',
  duration: '00:00:00',
};

const GROUP_TARGET_EMPTY_DURATION: MintBookingLinkTarget = {
  kind: 'group',
  id: 12,
  name: 'Blank Team',
  duration: '',
};

function renderDialog(
  target: MintBookingLinkTarget = CALENDAR_TARGET,
  open = true,
  onOpenChangeFn?: (open: boolean) => void
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const onOpenChange = onOpenChangeFn ?? vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const utils = render(
    <MintBookingLinkDialog
      open={open}
      onOpenChange={onOpenChange}
      target={target}
    />,
    { wrapper }
  );
  return { ...utils, onOpenChange, queryClient };
}

describe('MintBookingLinkDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOrgSlug('acme');
  });

  it('offers a duration control for a calendar target', () => {
    renderDialog(CALENDAR_TARGET);

    expect(screen.getByLabelText('Booking duration value')).toBeInTheDocument();
  });

  it('offers no duration control for a group target, and explains why', () => {
    renderDialog(GROUP_TARGET);

    expect(
      screen.queryByLabelText('Booking duration value')
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/group's own duration applies/i)
    ).toBeInTheDocument();
  });

  it('mints a calendar link and surfaces the URL with ?duration= when a nonzero duration is chosen', async () => {
    const user = userEvent.setup();
    vi.mocked(bookingCodesCreate).mockResolvedValueOnce(
      makeMintResponse(makeMintResult({ calendar: 5 }))
    );

    renderDialog(CALENDAR_TARGET);

    const durationInput = screen.getByLabelText('Booking duration value');
    await user.clear(durationInput);
    await user.type(durationInput, '30');

    await user.click(screen.getByTestId('create-booking-link-submit'));

    const urlInput = (await screen.findByTestId(
      'booking-link-url-input'
    )) as HTMLInputElement;

    expect(bookingCodesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ purpose: 'book', calendar: 5 }),
      })
    );
    expect(urlInput.value).toContain(`/o/acme/book/${ONE_TIME_CODE}`);
    expect(urlInput.value).toContain('duration=1800');
  });

  it('blocks minting a calendar link with a zero duration and issues no mutation', async () => {
    const user = userEvent.setup();

    renderDialog(CALENDAR_TARGET);

    const durationInput = screen.getByLabelText('Booking duration value');
    await user.clear(durationInput);
    await user.type(durationInput, '0');

    await user.click(screen.getByTestId('create-booking-link-submit'));

    expect(
      await screen.findByText(/duration greater than zero/i)
    ).toBeInTheDocument();
    expect(bookingCodesCreate).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId('booking-link-url-input')
    ).not.toBeInTheDocument();
  });

  it('defaults a calendar target to a working non-zero duration (30 minutes)', async () => {
    const user = userEvent.setup();
    vi.mocked(bookingCodesCreate).mockResolvedValueOnce(
      makeMintResponse(makeMintResult({ calendar: 5 }))
    );

    renderDialog(CALENDAR_TARGET);
    // Duration control untouched — exercises the default value directly.
    await user.click(screen.getByTestId('create-booking-link-submit'));

    const urlInput = (await screen.findByTestId(
      'booking-link-url-input'
    )) as HTMLInputElement;
    expect(urlInput.value).toContain('duration=1800');
  });

  it.each([
    ['unset', GROUP_TARGET_NO_DURATION],
    ['zero-valued', GROUP_TARGET_ZERO_DURATION],
    ['empty', GROUP_TARGET_EMPTY_DURATION],
  ] as const)(
    'blocks minting for a group with %s duration, explains why, and issues no mutation',
    (_label, target) => {
      renderDialog(target);

      expect(
        screen.getByText(/can't take public bookings yet/i)
      ).toBeInTheDocument();
      expect(
        screen.getByTestId('group-duration-required-notice')
      ).toHaveTextContent(/needs a duration/i);
      expect(
        screen.queryByTestId('create-booking-link-submit')
      ).not.toBeInTheDocument();
      expect(bookingCodesCreate).not.toHaveBeenCalled();
    }
  );

  it('does not block minting for a group with a real duration', () => {
    renderDialog(GROUP_TARGET);

    expect(
      screen.queryByText(/can't take public bookings yet/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('create-booking-link-submit')
    ).toBeInTheDocument();
  });

  it('does not block minting for a calendar target, regardless of any duration field', () => {
    renderDialog(CALENDAR_TARGET);

    expect(
      screen.queryByText(/can't take public bookings yet/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('create-booking-link-submit')
    ).toBeInTheDocument();
  });

  it('mints a group link and surfaces a URL with no ?duration=, regardless of anything a caller might supply', async () => {
    const user = userEvent.setup();
    vi.mocked(bookingCodesCreate).mockResolvedValueOnce(
      makeMintResponse(makeMintResult({ calendar_group: 9 }))
    );

    renderDialog(GROUP_TARGET);
    await user.click(screen.getByTestId('create-booking-link-submit'));

    const urlInput = (await screen.findByTestId(
      'booking-link-url-input'
    )) as HTMLInputElement;

    expect(bookingCodesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          purpose: 'book',
          calendar_group: 9,
        }),
      })
    );
    expect(urlInput.value).toContain(`/o/acme/book/${ONE_TIME_CODE}`);
    expect(urlInput.value).not.toContain('duration=');
  });

  it('shows the one-time reveal notice and a copy button after minting', async () => {
    const user = userEvent.setup();
    vi.mocked(bookingCodesCreate).mockResolvedValueOnce(
      makeMintResponse(makeMintResult())
    );

    renderDialog(CALENDAR_TARGET);
    await user.click(screen.getByTestId('create-booking-link-submit'));

    await screen.findByTestId('booking-link-url-input');
    expect(screen.getByTestId('one-time-reveal-notice')).toHaveTextContent(
      /cannot be shown again/i
    );
    expect(screen.getByTestId('copy-booking-link-button')).toBeInTheDocument();
  });

  it('the link is gone from the DOM and mutation cache after the dialog closes', async () => {
    const user = userEvent.setup();
    vi.mocked(bookingCodesCreate).mockResolvedValueOnce(
      makeMintResponse(makeMintResult())
    );

    const handleOpenChange = vi.fn();

    const { rerender, queryClient } = renderDialog(
      CALENDAR_TARGET,
      true,
      handleOpenChange
    );

    await user.click(screen.getByTestId('create-booking-link-submit'));
    const urlInput = (await screen.findByTestId(
      'booking-link-url-input'
    )) as HTMLInputElement;
    expect(urlInput.value).toContain(ONE_TIME_CODE);

    await user.click(screen.getByTestId('done-button'));
    expect(handleOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <MintBookingLinkDialog
        open={false}
        onOpenChange={handleOpenChange}
        target={CALENDAR_TARGET}
      />
    );

    expect(
      screen.queryByTestId('booking-link-url-input')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByDisplayValue(new RegExp(ONE_TIME_CODE))
    ).not.toBeInTheDocument();
    // Regression for BLOCKER 1: `gcTime: 0` on the create mutation must keep
    // the plaintext code out of the mutation cache too, not just the DOM.
    // `gcTime: 0` still schedules `optionalRemove()` via a 0ms timer rather
    // than removing synchronously (`Removable.scheduleGc`), so this must be
    // awaited rather than asserted immediately.
    await waitFor(() => {
      expect(
        queryClient
          .getMutationCache()
          .getAll()
          .every(
            (m) => !JSON.stringify(m.state.data ?? '').includes(ONE_TIME_CODE)
          )
      ).toBe(true);
    });
  });

  it('the link is gone from the mutation cache after the dialog unmounts', async () => {
    const user = userEvent.setup();
    vi.mocked(bookingCodesCreate).mockResolvedValueOnce(
      makeMintResponse(makeMintResult())
    );

    const { unmount, queryClient } = renderDialog(CALENDAR_TARGET, true);

    await user.click(screen.getByTestId('create-booking-link-submit'));
    const urlInput = (await screen.findByTestId(
      'booking-link-url-input'
    )) as HTMLInputElement;
    expect(urlInput.value).toContain(ONE_TIME_CODE);

    // The two table call sites unmount the dialog on close rather than
    // rerendering it with `open={false}` — this is what that looks like.
    unmount();

    // See the same note above: `gcTime: 0` still removes on a 0ms timer.
    await waitFor(() => {
      expect(
        queryClient
          .getMutationCache()
          .getAll()
          .every(
            (m) => !JSON.stringify(m.state.data ?? '').includes(ONE_TIME_CODE)
          )
      ).toBe(true);
    });
  });

  it('revoke calls bookingCodesDestroy with the minted id and moves to the revoked state', async () => {
    const user = userEvent.setup();
    vi.mocked(bookingCodesCreate).mockResolvedValueOnce(
      makeMintResponse(makeMintResult({ id: 77 }))
    );
    vi.mocked(bookingCodesDestroy).mockResolvedValueOnce(makeDestroyResponse());

    renderDialog(CALENDAR_TARGET);
    await user.click(screen.getByTestId('create-booking-link-submit'));
    await screen.findByTestId('booking-link-url-input');

    await user.click(screen.getByTestId('revoke-booking-link-button'));

    expect(bookingCodesDestroy).toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: '77' } })
    );
    expect(await screen.findByTestId('revoked-notice')).toBeInTheDocument();
    expect(
      screen.queryByTestId('revoke-booking-link-button')
    ).not.toBeInTheDocument();
  });

  it('a failed mint reveals nothing and surfaces the failure', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    vi.mocked(bookingCodesCreate).mockRejectedValueOnce(
      new Error('Not permitted')
    );

    renderDialog(CALENDAR_TARGET);
    await user.click(screen.getByTestId('create-booking-link-submit'));

    expect(
      screen.queryByTestId('booking-link-url-input')
    ).not.toBeInTheDocument();
    // Still on the form view.
    expect(
      screen.getByTestId('create-booking-link-submit')
    ).toBeInTheDocument();
    // The failure must be surfaced, not silently swallowed.
    expect(toast.error).toHaveBeenCalledWith(
      'Failed to generate link',
      expect.objectContaining({ description: expect.any(String) })
    );
  });

  it('does not call console.log with the plaintext code', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const user = userEvent.setup();
    vi.mocked(bookingCodesCreate).mockResolvedValueOnce(
      makeMintResponse(makeMintResult())
    );

    renderDialog(CALENDAR_TARGET);
    await user.click(screen.getByTestId('create-booking-link-submit'));
    await screen.findByTestId('booking-link-url-input');

    const allLogCalls = consoleSpy.mock.calls.flat().join(' ');
    expect(allLogCalls).not.toContain(ONE_TIME_CODE);

    consoleSpy.mockRestore();
  });

  it('copy-to-clipboard writes the full URL, including the code, to the clipboard', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    vi.mocked(bookingCodesCreate).mockResolvedValueOnce(
      makeMintResponse(makeMintResult())
    );

    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      writable: true,
      configurable: true,
    });

    renderDialog(CALENDAR_TARGET);
    await user.click(screen.getByTestId('create-booking-link-submit'));
    const urlInput = (await screen.findByTestId(
      'booking-link-url-input'
    )) as HTMLInputElement;

    await user.click(screen.getByTestId('copy-booking-link-button'));

    expect(writeTextSpy).toHaveBeenCalledWith(urlInput.value);
  });
});
