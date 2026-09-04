/**
 * PublicBookingFlow integration tests.
 *
 * Covers (per the phase spec):
 * - Slots render; submitting books and confirms.
 * - An opaque 403 on the slot read renders `link-invalid` and NEVER
 *   "expired" or "already used" wording — proving the read failure stays
 *   undifferentiated regardless of what the (unread) response body says.
 * - `409 SLOT_UNAVAILABLE` on submit returns to slot selection with the
 *   slot list refetched.
 * - `409 ALREADY_USED` and `410 EXPIRED` are terminal and rendered with
 *   distinct copy.
 * - REGRESSION: a proposal whose span disagrees with the URL's `?duration=`
 *   renders at the PROPOSAL's length, never the requested one.
 *
 * `@/client/sdk.gen` is mocked (not `usePublicBookableSlots` /
 * `usePublicBookEvent` themselves) so the hooks' real wiring — building the
 * query, reading `response`, mapping failures — is exercised end to end,
 * same convention as `mint-booking-link-dialog.test.tsx`.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// jsdom polyfills Radix needs (RadioGroup, Combobox's Popover/Command).
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
});

// ---------------------------------------------------------------------------
// Mocks — declared before any import that uses them.
// ---------------------------------------------------------------------------

let currentSearch = new URLSearchParams({ duration: '1800' });
vi.mock('next/navigation', () => ({
  useSearchParams: () => currentSearch,
}));

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    publicBookingCalendarBookableSlotsList: vi.fn(),
    publicBookingCalendarEventsCreate: vi.fn(),
  };
});

import {
  publicBookingCalendarBookableSlotsList,
  publicBookingCalendarEventsCreate,
} from '@/client/sdk.gen';
import type { BookableSlotProposal, CalendarEvent } from '@/client';
import { PublicBookingFlow } from './public-booking-flow';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function slotsOk(
  proposals: BookableSlotProposal[]
): Awaited<ReturnType<typeof publicBookingCalendarBookableSlotsList>> {
  return {
    data: proposals,
    response: new Response(JSON.stringify(proposals), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingCalendarBookableSlotsList>
  >;
}

function slotsFailed(
  status: number,
  body: unknown = { detail: 'Invalid or expired code.' }
): Awaited<ReturnType<typeof publicBookingCalendarBookableSlotsList>> {
  return {
    data: undefined,
    error: body,
    response: new Response(JSON.stringify(body), { status }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingCalendarBookableSlotsList>
  >;
}

function eventOk(
  event: CalendarEvent
): Awaited<ReturnType<typeof publicBookingCalendarEventsCreate>> {
  return {
    data: event,
    response: new Response(JSON.stringify(event), { status: 201 }),
  } as unknown as Awaited<ReturnType<typeof publicBookingCalendarEventsCreate>>;
}

function eventFailed(
  status: number,
  errorCode: string,
  detail: string
): Awaited<ReturnType<typeof publicBookingCalendarEventsCreate>> {
  const body = { error_code: errorCode, detail };
  return {
    data: undefined,
    error: body,
    response: new Response(JSON.stringify(body), { status }),
  } as unknown as Awaited<ReturnType<typeof publicBookingCalendarEventsCreate>>;
}

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 1,
    title: 'Appointment',
    start_time: '2026-03-02T10:00:00.000Z',
    end_time: '2026-03-02T10:30:00.000Z',
    timezone: 'UTC',
    created: '2026-03-01T00:00:00.000Z',
    modified: '2026-03-01T00:00:00.000Z',
    external_id: 'evt-1',
    external_attendances: [],
    attendances: [],
    resource_allocations: [],
    group_selections: [],
    parent_recurring_object: {
      id: 0,
      title: '',
      external_id: '',
      start_time: '2026-03-01T00:00:00.000Z',
      end_time: '2026-03-01T00:00:00.000Z',
      created: '2026-03-01T00:00:00.000Z',
      modified: '2026-03-01T00:00:00.000Z',
    },
    is_recurring_instance: false,
    is_recurring: false,
    ...overrides,
  } as CalendarEvent;
}

function renderFlow(code = 'secret-code') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<PublicBookingFlow code={code} />, { wrapper: Wrapper });
}

/** Fills the attendee form's required email and submits it. */
async function fillAndSubmitAttendeeForm(
  user: ReturnType<typeof userEvent.setup>
) {
  const emailInput = await screen.findByTestId('attendee-email-input');
  await user.type(emailInput, 'attendee@example.com');
  await user.click(screen.getByTestId('attendee-form-submit'));
}

async function selectFirstSlot(user: ReturnType<typeof userEvent.setup>) {
  // `findAllByRole` — a day with 2+ proposals renders multiple radios, and
  // `findByRole` (singular) throws "found multiple elements" instead of
  // selecting the first one.
  const [radio] = await screen.findAllByRole('radio');
  await user.click(radio);
}

beforeEach(() => {
  vi.clearAllMocks();
  currentSearch = new URLSearchParams({ duration: '1800' });
});

describe('PublicBookingFlow', () => {
  it('renders bookable slots, and submitting books and confirms', async () => {
    const user = userEvent.setup();
    vi.mocked(publicBookingCalendarBookableSlotsList).mockResolvedValueOnce(
      slotsOk([
        {
          start_time: '2026-03-02T10:00:00.000Z',
          end_time: '2026-03-02T10:30:00.000Z',
        },
      ])
    );
    vi.mocked(publicBookingCalendarEventsCreate).mockResolvedValueOnce(
      eventOk(makeEvent())
    );

    renderFlow();

    await selectFirstSlot(user);
    await fillAndSubmitAttendeeForm(user);

    await waitFor(() =>
      expect(screen.getByTestId('booking-confirmation')).toBeInTheDocument()
    );
    expect(vi.mocked(publicBookingCalendarEventsCreate)).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'X-Booking-Code': 'secret-code' },
        body: expect.objectContaining({
          start_time: '2026-03-02T10:00:00.000Z',
          end_time: '2026-03-02T10:30:00.000Z',
          external_attendee: { email: 'attendee@example.com' },
        }),
      })
    );
  });

  it('renders the ONE opaque link-invalid state on a 403 read failure, never "expired" or "already used" wording', async () => {
    vi.mocked(publicBookingCalendarBookableSlotsList).mockResolvedValueOnce(
      slotsFailed(403, { detail: 'This booking code has expired.' })
    );

    renderFlow();

    await waitFor(() =>
      expect(screen.getByTestId('link-invalid')).toBeInTheDocument()
    );
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toMatch(/expired/i);
    expect(bodyText).not.toMatch(/already used/i);
    expect(bodyText).not.toMatch(/revoked/i);
  });

  it('SLOT_UNAVAILABLE on submit returns to slot selection with the slot list refetched', async () => {
    const user = userEvent.setup();
    vi.mocked(publicBookingCalendarBookableSlotsList)
      .mockResolvedValueOnce(
        slotsOk([
          {
            start_time: '2026-03-02T10:00:00.000Z',
            end_time: '2026-03-02T10:30:00.000Z',
          },
        ])
      )
      .mockResolvedValueOnce(
        slotsOk([
          {
            start_time: '2026-03-03T14:00:00.000Z',
            end_time: '2026-03-03T14:30:00.000Z',
          },
        ])
      );
    vi.mocked(publicBookingCalendarEventsCreate).mockResolvedValueOnce(
      eventFailed(409, 'SLOT_UNAVAILABLE', 'Slot no longer available')
    );

    renderFlow();

    await selectFirstSlot(user);
    await fillAndSubmitAttendeeForm(user);

    // Back at slot selection, with the warning notice and a refetched list.
    await waitFor(() =>
      expect(screen.getByTestId('slot-unavailable-notice')).toBeInTheDocument()
    );
    expect(screen.getByRole('radio')).toBeInTheDocument();
    expect(
      vi.mocked(publicBookingCalendarBookableSlotsList)
    ).toHaveBeenCalledTimes(2);
    // The second (refetched) proposal is now what's on screen.
    expect(screen.getByText(/Mar 3, 2026/)).toBeInTheDocument();
  });

  it.each([
    ['ALREADY_USED', 409, 'already been used'],
    ['EXPIRED', 410, 'has expired'],
  ] as const)(
    '%s (%d) is a terminal, distinct failure',
    async (errorCode, status, expectedPhrase) => {
      const user = userEvent.setup();
      vi.mocked(publicBookingCalendarBookableSlotsList).mockResolvedValueOnce(
        slotsOk([
          {
            start_time: '2026-03-02T10:00:00.000Z',
            end_time: '2026-03-02T10:30:00.000Z',
          },
        ])
      );
      vi.mocked(publicBookingCalendarEventsCreate).mockResolvedValueOnce(
        eventFailed(status, errorCode, `${errorCode} happened`)
      );

      renderFlow();

      await selectFirstSlot(user);
      await fillAndSubmitAttendeeForm(user);

      await waitFor(() =>
        expect(screen.getByTestId('booking-terminal-error')).toBeInTheDocument()
      );
      expect(
        within(screen.getByTestId('booking-terminal-error')).getByText(
          new RegExp(expectedPhrase, 'i')
        )
      ).toBeInTheDocument();
      // Terminal means no way back to slot selection from here.
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
      // Only one read call — a terminal failure does not trigger a refetch.
      expect(
        vi.mocked(publicBookingCalendarBookableSlotsList)
      ).toHaveBeenCalledTimes(1);
    }
  );

  it('ALREADY_USED and EXPIRED render distinct copy from each other', async () => {
    const user = userEvent.setup();
    vi.mocked(publicBookingCalendarBookableSlotsList)
      .mockResolvedValueOnce(
        slotsOk([
          {
            start_time: '2026-03-02T10:00:00.000Z',
            end_time: '2026-03-02T10:30:00.000Z',
          },
        ])
      )
      .mockResolvedValueOnce(
        slotsOk([
          {
            start_time: '2026-03-02T10:00:00.000Z',
            end_time: '2026-03-02T10:30:00.000Z',
          },
        ])
      );
    vi.mocked(publicBookingCalendarEventsCreate)
      .mockResolvedValueOnce(eventFailed(409, 'ALREADY_USED', 'used already'))
      .mockResolvedValueOnce(eventFailed(410, 'EXPIRED', 'now expired'));

    const { unmount } = renderFlow('code-a');
    await selectFirstSlot(user);
    await fillAndSubmitAttendeeForm(user);
    await waitFor(() =>
      expect(screen.getByTestId('booking-terminal-error')).toBeInTheDocument()
    );
    const usedText = screen.getByTestId(
      'booking-terminal-error-description'
    ).textContent;
    unmount();

    renderFlow('code-b');
    await selectFirstSlot(user);
    await fillAndSubmitAttendeeForm(user);
    await waitFor(() =>
      expect(screen.getByTestId('booking-terminal-error')).toBeInTheDocument()
    );
    const expiredText = screen.getByTestId(
      'booking-terminal-error-description'
    ).textContent;

    expect(usedText).not.toEqual(expiredText);
  });

  it('renders the missing-duration card and issues no slot read when ?duration= is absent', () => {
    // No `?duration=` at all — a broken/hand-edited link, not a code-validity
    // question, so it must never route through the read hook or LinkInvalid.
    currentSearch = new URLSearchParams();

    renderFlow();

    expect(screen.getByTestId('invalid-duration')).toBeInTheDocument();
    expect(
      vi.mocked(publicBookingCalendarBookableSlotsList)
    ).not.toHaveBeenCalled();
  });

  it('renders the missing-duration card for a malformed (non-numeric) ?duration=', () => {
    currentSearch = new URLSearchParams({ duration: 'not-a-number' });

    renderFlow();

    expect(screen.getByTestId('invalid-duration')).toBeInTheDocument();
    expect(
      vi.mocked(publicBookingCalendarBookableSlotsList)
    ).not.toHaveBeenCalled();
  });

  it('renders a generic load-error card (not link-invalid) on a non-403 slot-read failure', async () => {
    vi.mocked(publicBookingCalendarBookableSlotsList).mockResolvedValueOnce(
      slotsFailed(500, { detail: 'Internal server error' })
    );

    renderFlow();

    await waitFor(() =>
      expect(screen.getByTestId('slots-load-error')).toBeInTheDocument()
    );
    expect(screen.queryByTestId('link-invalid')).not.toBeInTheDocument();

    // The retry button refetches rather than leaving a dead end.
    vi.mocked(publicBookingCalendarBookableSlotsList).mockResolvedValueOnce(
      slotsOk([
        {
          start_time: '2026-03-02T10:00:00.000Z',
          end_time: '2026-03-02T10:30:00.000Z',
        },
      ])
    );
    await userEvent.setup().click(screen.getByTestId('retry-load-slots'));
    await waitFor(() =>
      expect(screen.queryByTestId('slots-load-error')).not.toBeInTheDocument()
    );
  });

  it('REGRESSION: renders a proposal at ITS OWN length, not the requested ?duration=', async () => {
    // The URL asks for 1800s (30 min); the returned proposal spans 45 min —
    // simulating a server-side pin silently overriding the request. The
    // picker must show 45 min, never 30.
    currentSearch = new URLSearchParams({ duration: '1800' });
    vi.mocked(publicBookingCalendarBookableSlotsList).mockResolvedValueOnce(
      slotsOk([
        {
          start_time: '2026-03-02T10:00:00.000Z',
          end_time: '2026-03-02T10:45:00.000Z',
        },
      ])
    );

    renderFlow();

    await waitFor(() => expect(screen.getByText('45 min')).toBeInTheDocument());
    expect(screen.queryByText('30 min')).not.toBeInTheDocument();

    // The request itself still carried the URL's requested duration — only
    // the RENDERED value must come from the response.
    expect(
      vi.mocked(publicBookingCalendarBookableSlotsList)
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ duration_seconds: 1800 }),
      })
    );
  });
});
