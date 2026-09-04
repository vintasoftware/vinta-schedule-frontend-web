/**
 * PublicGroupBookingFlow integration tests.
 *
 * Covers (per the phase spec):
 * - Whole-group proposals render; picking one loads per-slot availability
 *   and renders the server-pinned duration read off the SELECTED
 *   PROPOSAL's own span — never a client-requested value (the group flow
 *   sends no duration of its own to the write, and the read's
 *   `duration_seconds` is a fixed technical placeholder, never
 *   user-configurable).
 * - A complete, satisfiable selection books with the right `slot_selections`
 *   and confirms.
 * - An opaque 403 on EITHER read (proposals or per-range availability)
 *   renders the one `link-invalid` state.
 * - `409 SLOT_UNAVAILABLE` on submit returns all the way to whole-group time
 *   selection with the proposal list refetched.
 * - `409 ALREADY_USED` / `410 EXPIRED` are terminal and distinct, reusing
 *   `terminalErrorCopy`.
 *
 * `@/client/sdk.gen` is mocked (not the hooks themselves), matching
 * `public-booking-flow.test.tsx`'s convention.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

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

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    publicBookingCalendarGroupBookableSlotsList: vi.fn(),
    publicBookingCalendarGroupAvailabilityCreate: vi.fn(),
    publicBookingCalendarGroupsEventsCreate: vi.fn(),
  };
});

import {
  publicBookingCalendarGroupBookableSlotsList,
  publicBookingCalendarGroupAvailabilityCreate,
  publicBookingCalendarGroupsEventsCreate,
} from '@/client/sdk.gen';
import type {
  BookableSlotProposal,
  CalendarEvent,
  CalendarGroupRangeAvailability,
} from '@/client';
import { PublicGroupBookingFlow } from './public-group-booking-flow';

function proposalsOk(
  proposals: BookableSlotProposal[]
): Awaited<ReturnType<typeof publicBookingCalendarGroupBookableSlotsList>> {
  return {
    data: proposals,
    response: new Response(JSON.stringify(proposals), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingCalendarGroupBookableSlotsList>
  >;
}

function proposalsFailed(
  status: number,
  body: unknown = { detail: 'Invalid or expired code.' }
): Awaited<ReturnType<typeof publicBookingCalendarGroupBookableSlotsList>> {
  return {
    data: undefined,
    error: body,
    response: new Response(JSON.stringify(body), { status }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingCalendarGroupBookableSlotsList>
  >;
}

function availabilityOk(
  range: CalendarGroupRangeAvailability
): Awaited<ReturnType<typeof publicBookingCalendarGroupAvailabilityCreate>> {
  const body = { count: 1, results: [range] };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingCalendarGroupAvailabilityCreate>
  >;
}

function availabilityFailed(
  status: number,
  body: unknown = { detail: 'Invalid or expired code.' }
): Awaited<ReturnType<typeof publicBookingCalendarGroupAvailabilityCreate>> {
  return {
    data: undefined,
    error: body,
    response: new Response(JSON.stringify(body), { status }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingCalendarGroupAvailabilityCreate>
  >;
}

function eventOk(
  event: CalendarEvent
): Awaited<ReturnType<typeof publicBookingCalendarGroupsEventsCreate>> {
  return {
    data: event,
    response: new Response(JSON.stringify(event), { status: 201 }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingCalendarGroupsEventsCreate>
  >;
}

function eventFailed(
  status: number,
  errorCode: string,
  detail: string
): Awaited<ReturnType<typeof publicBookingCalendarGroupsEventsCreate>> {
  const body = { error_code: errorCode, detail };
  return {
    data: undefined,
    error: body,
    response: new Response(JSON.stringify(body), { status }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingCalendarGroupsEventsCreate>
  >;
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

const PROPOSAL: BookableSlotProposal = {
  start_time: '2026-03-02T10:00:00.000Z',
  end_time: '2026-03-02T10:45:00.000Z', // 45 min — proves the render uses the proposal's own span
};

const RANGE_AVAILABILITY: CalendarGroupRangeAvailability = {
  start_time: PROPOSAL.start_time,
  end_time: PROPOSAL.end_time,
  slots: [
    {
      slot_id: 1,
      available_calendar_ids: [10],
      required_count: 1,
      is_bookable: true,
    },
  ],
};

function renderFlow(code = 'secret-code') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<PublicGroupBookingFlow code={code} />, { wrapper: Wrapper });
}

async function pickProposalAndCompleteSlots(
  user: ReturnType<typeof userEvent.setup>
) {
  const radio = await screen.findByRole('radio');
  await user.click(radio);
  const candidate = await screen.findByTestId('group-slot-1-option-10');
  await user.click(candidate);
  await user.click(screen.getByTestId('group-slot-selection-continue'));
}

async function fillAndSubmitAttendeeForm(
  user: ReturnType<typeof userEvent.setup>
) {
  const emailInput = await screen.findByTestId('attendee-email-input');
  await user.type(emailInput, 'attendee@example.com');
  await user.click(screen.getByTestId('attendee-form-submit'));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PublicGroupBookingFlow', () => {
  it('renders whole-group proposals and, once one is picked, renders the PROPOSAL length, never a locally requested one', async () => {
    const user = userEvent.setup();
    vi.mocked(
      publicBookingCalendarGroupBookableSlotsList
    ).mockResolvedValueOnce(proposalsOk([PROPOSAL]));
    vi.mocked(
      publicBookingCalendarGroupAvailabilityCreate
    ).mockResolvedValueOnce(availabilityOk(RANGE_AVAILABILITY));

    renderFlow();

    const radio = await screen.findByRole('radio');
    await user.click(radio);

    await waitFor(() =>
      expect(screen.getByText('45 min appointment')).toBeInTheDocument()
    );
    // The read still had to carry SOME duration_seconds (required by the
    // endpoint), but it is never surfaced — only the request itself.
    expect(
      vi.mocked(publicBookingCalendarGroupBookableSlotsList)
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          duration_seconds: expect.any(Number),
        }),
      })
    );
  });

  it('a satisfiable selection books with the right slot_selections and confirms', async () => {
    const user = userEvent.setup();
    vi.mocked(
      publicBookingCalendarGroupBookableSlotsList
    ).mockResolvedValueOnce(proposalsOk([PROPOSAL]));
    vi.mocked(
      publicBookingCalendarGroupAvailabilityCreate
    ).mockResolvedValueOnce(availabilityOk(RANGE_AVAILABILITY));
    vi.mocked(publicBookingCalendarGroupsEventsCreate).mockResolvedValueOnce(
      eventOk(makeEvent())
    );

    renderFlow();

    await pickProposalAndCompleteSlots(user);
    await fillAndSubmitAttendeeForm(user);

    await waitFor(() =>
      expect(screen.getByTestId('booking-confirmation')).toBeInTheDocument()
    );
    expect(
      vi.mocked(publicBookingCalendarGroupsEventsCreate)
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'X-Booking-Code': 'secret-code' },
        body: expect.objectContaining({
          start_time: PROPOSAL.start_time,
          end_time: PROPOSAL.end_time,
          slot_selections: [{ slot_id: 1, calendar_ids: [10] }],
          external_attendee: { email: 'attendee@example.com' },
        }),
      })
    );
  });

  it('renders the ONE opaque link-invalid state on a 403 proposals-read failure', async () => {
    vi.mocked(
      publicBookingCalendarGroupBookableSlotsList
    ).mockResolvedValueOnce(
      proposalsFailed(403, { detail: 'This code has expired.' })
    );

    renderFlow();

    await waitFor(() =>
      expect(screen.getByTestId('link-invalid')).toBeInTheDocument()
    );
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toMatch(/expired/i);
  });

  it('renders the ONE opaque link-invalid state on a 403 per-range availability failure', async () => {
    const user = userEvent.setup();
    vi.mocked(
      publicBookingCalendarGroupBookableSlotsList
    ).mockResolvedValueOnce(proposalsOk([PROPOSAL]));
    vi.mocked(
      publicBookingCalendarGroupAvailabilityCreate
    ).mockResolvedValueOnce(availabilityFailed(403));

    renderFlow();

    const radio = await screen.findByRole('radio');
    await user.click(radio);

    await waitFor(() =>
      expect(screen.getByTestId('link-invalid')).toBeInTheDocument()
    );
  });

  it('SLOT_UNAVAILABLE on submit returns to whole-group time selection with the proposal list refetched', async () => {
    const user = userEvent.setup();
    vi.mocked(publicBookingCalendarGroupBookableSlotsList)
      .mockResolvedValueOnce(proposalsOk([PROPOSAL]))
      .mockResolvedValueOnce(
        proposalsOk([
          {
            start_time: '2026-03-03T14:00:00.000Z',
            end_time: '2026-03-03T14:30:00.000Z',
          },
        ])
      );
    vi.mocked(
      publicBookingCalendarGroupAvailabilityCreate
    ).mockResolvedValueOnce(availabilityOk(RANGE_AVAILABILITY));
    vi.mocked(publicBookingCalendarGroupsEventsCreate).mockResolvedValueOnce(
      eventFailed(409, 'SLOT_UNAVAILABLE', 'Slot no longer available')
    );

    renderFlow();

    await pickProposalAndCompleteSlots(user);
    await fillAndSubmitAttendeeForm(user);

    await waitFor(() =>
      expect(
        screen.getByTestId('group-slot-unavailable-notice')
      ).toBeInTheDocument()
    );
    expect(screen.getByRole('radio')).toBeInTheDocument();
    expect(
      vi.mocked(publicBookingCalendarGroupBookableSlotsList)
    ).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['ALREADY_USED', 409, 'already been used'],
    ['EXPIRED', 410, 'has expired'],
  ] as const)(
    '%s (%d) is a terminal, distinct failure',
    async (errorCode, status, expectedPhrase) => {
      const user = userEvent.setup();
      vi.mocked(
        publicBookingCalendarGroupBookableSlotsList
      ).mockResolvedValueOnce(proposalsOk([PROPOSAL]));
      vi.mocked(
        publicBookingCalendarGroupAvailabilityCreate
      ).mockResolvedValueOnce(availabilityOk(RANGE_AVAILABILITY));
      vi.mocked(publicBookingCalendarGroupsEventsCreate).mockResolvedValueOnce(
        eventFailed(status, errorCode, `${errorCode} happened`)
      );

      renderFlow();

      await pickProposalAndCompleteSlots(user);
      await fillAndSubmitAttendeeForm(user);

      await waitFor(() =>
        expect(
          screen.getByTestId('group-booking-terminal-error')
        ).toBeInTheDocument()
      );
      expect(
        within(screen.getByTestId('group-booking-terminal-error')).getByText(
          new RegExp(expectedPhrase, 'i')
        )
      ).toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    }
  );
});
