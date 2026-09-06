/**
 * CodelessAppointmentTypeBookingFlow integration tests.
 *
 * Covers (per Phase 7 spec):
 * - A public appointment type's page shows slots and books with NO code, and no
 *   request carries `X-Booking-Code`.
 * - An unknown slug (404) renders `<CodelessAppointmentTypeNotFound />`; a real but
 *   non-public appointment type (403) renders `<CodelessAppointmentTypeUnavailable />` — the two
 *   are distinct.
 * - Booking twice through the SAME slug succeeds both times — the property
 *   that distinguishes this flow from every code-gated one.
 * - `409 SLOT_UNAVAILABLE` on submit returns to whole-appointment-type time selection
 *   with the proposal list refetched; `ALREADY_USED` / `EXPIRED` remain
 *   terminal and distinct (the write's vocabulary is unchanged).
 * - The write's `201` still carries Phase 5's `management` object and
 *   `booking-confirmation.tsx` renders it unchanged.
 *
 * `@/client/sdk.gen` is mocked, matching every other public flow test in
 * this directory.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    publicBookingAppointmentTypesBookableSlotsList: vi.fn(),
    publicBookingAppointmentTypesAvailabilityCreate: vi.fn(),
    publicBookingAppointmentTypesEventsCreate: vi.fn(),
  };
});

import {
  publicBookingAppointmentTypesBookableSlotsList,
  publicBookingAppointmentTypesAvailabilityCreate,
  publicBookingAppointmentTypesEventsCreate,
} from '@/client/sdk.gen';
import type {
  BookableSlotProposal,
  CalendarEvent,
  AppointmentTypeRangeAvailability,
} from '@/client';
import { CodelessAppointmentTypeBookingFlow } from './codeless-appointment-type-booking-flow';

function proposalsOk(
  proposals: BookableSlotProposal[]
): Awaited<ReturnType<typeof publicBookingAppointmentTypesBookableSlotsList>> {
  return {
    data: proposals,
    response: new Response(JSON.stringify(proposals), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingAppointmentTypesBookableSlotsList>
  >;
}

function proposalsFailed(
  status: number,
  body: unknown = { detail: 'Not found.' }
): Awaited<ReturnType<typeof publicBookingAppointmentTypesBookableSlotsList>> {
  return {
    data: undefined,
    error: body,
    response: new Response(JSON.stringify(body), { status }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingAppointmentTypesBookableSlotsList>
  >;
}

function availabilityOk(
  range: AppointmentTypeRangeAvailability
): Awaited<ReturnType<typeof publicBookingAppointmentTypesAvailabilityCreate>> {
  const body = { count: 1, results: [range] };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingAppointmentTypesAvailabilityCreate>
  >;
}

function eventOk(
  event: CalendarEvent
): Awaited<ReturnType<typeof publicBookingAppointmentTypesEventsCreate>> {
  return {
    data: event,
    response: new Response(JSON.stringify(event), { status: 201 }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingAppointmentTypesEventsCreate>
  >;
}

/** A `201` carrying Phase 5's `management` object. */
function eventOkWithManagement(
  event: CalendarEvent,
  managementCodes: { reschedule_code: string; cancel_code: string }
): Awaited<ReturnType<typeof publicBookingAppointmentTypesEventsCreate>> {
  const withManagement = { ...event, management: managementCodes };
  return {
    data: withManagement,
    response: new Response(JSON.stringify(withManagement), { status: 201 }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingAppointmentTypesEventsCreate>
  >;
}

function eventFailed(
  status: number,
  errorCode: string,
  detail: string
): Awaited<ReturnType<typeof publicBookingAppointmentTypesEventsCreate>> {
  const body = { error_code: errorCode, detail };
  return {
    data: undefined,
    error: body,
    response: new Response(JSON.stringify(body), { status }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingAppointmentTypesEventsCreate>
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
    appointment_type_selections: [],
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
  end_time: '2026-03-02T10:45:00.000Z',
};

const RANGE_AVAILABILITY: AppointmentTypeRangeAvailability = {
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

function renderFlow(publicSlug = 'surgery-team', slug?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return {
    ...render(
      <CodelessAppointmentTypeBookingFlow
        publicSlug={publicSlug}
        slug={slug}
      />,
      { wrapper: Wrapper }
    ),
    queryClient,
  };
}

async function pickProposalAndCompleteSlots(
  user: ReturnType<typeof userEvent.setup>
) {
  const [radio] = await screen.findAllByRole('radio');
  await user.click(radio);
  const candidate = await screen.findByTestId(
    'appointment-type-slot-1-option-10'
  );
  await user.click(candidate);
  await user.click(
    screen.getByTestId('appointment-type-slot-selection-continue')
  );
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

describe('CodelessAppointmentTypeBookingFlow', () => {
  it('shows real slots and books with NO code — no request carries X-Booking-Code', async () => {
    const user = userEvent.setup();
    vi.mocked(
      publicBookingAppointmentTypesBookableSlotsList
    ).mockResolvedValueOnce(proposalsOk([PROPOSAL]));
    vi.mocked(
      publicBookingAppointmentTypesAvailabilityCreate
    ).mockResolvedValueOnce(availabilityOk(RANGE_AVAILABILITY));
    vi.mocked(publicBookingAppointmentTypesEventsCreate).mockResolvedValueOnce(
      eventOk(makeEvent())
    );

    renderFlow();

    await pickProposalAndCompleteSlots(user);
    await fillAndSubmitAttendeeForm(user);

    await waitFor(() =>
      expect(screen.getByTestId('booking-confirmation')).toBeInTheDocument()
    );

    // Every call this flow makes is addressed by public_slug, none by code.
    for (const mockFn of [
      publicBookingAppointmentTypesBookableSlotsList,
      publicBookingAppointmentTypesAvailabilityCreate,
      publicBookingAppointmentTypesEventsCreate,
    ]) {
      for (const call of vi.mocked(mockFn).mock.calls) {
        const options = call[0] as { headers?: unknown; path?: unknown };
        expect(options.headers).toBeUndefined();
        expect(options.path).toEqual({ public_slug: 'surgery-team' });
      }
    }
    expect(
      vi.mocked(publicBookingAppointmentTypesEventsCreate)
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          start_time: PROPOSAL.start_time,
          end_time: PROPOSAL.end_time,
          slot_selections: [{ slot_id: 1, calendar_ids: [10] }],
          external_attendee: { email: 'attendee@example.com' },
        }),
      })
    );
  });

  it('does not send duration_seconds on the codeless slots read', async () => {
    vi.mocked(
      publicBookingAppointmentTypesBookableSlotsList
    ).mockResolvedValueOnce(proposalsOk([PROPOSAL]));

    renderFlow();

    await screen.findAllByRole('radio');

    const call = vi.mocked(publicBookingAppointmentTypesBookableSlotsList).mock
      .calls[0][0] as { query?: Record<string, unknown> };
    expect(call.query).not.toHaveProperty('duration_seconds');
  });

  it('renders CodelessAppointmentTypeNotFound (not CodelessAppointmentTypeUnavailable) for an unknown slug (404)', async () => {
    vi.mocked(
      publicBookingAppointmentTypesBookableSlotsList
    ).mockResolvedValueOnce(proposalsFailed(404, { detail: 'Not found.' }));

    renderFlow('no-such-appointment-type');

    await waitFor(() =>
      expect(
        screen.getByTestId('codeless-appointment-type-not-found')
      ).toBeInTheDocument()
    );
    expect(
      screen.queryByTestId('codeless-appointment-type-unavailable')
    ).not.toBeInTheDocument();
  });

  it('renders CodelessAppointmentTypeUnavailable (not CodelessAppointmentTypeNotFound) for a real, non-public appointment type (403) — distinct from the 404 state', async () => {
    vi.mocked(
      publicBookingAppointmentTypesBookableSlotsList
    ).mockResolvedValueOnce(
      proposalsFailed(403, { detail: 'Not publicly bookable.' })
    );

    renderFlow('private-appointment-type');

    await waitFor(() =>
      expect(
        screen.getByTestId('codeless-appointment-type-unavailable')
      ).toBeInTheDocument()
    );
    expect(
      screen.queryByTestId('codeless-appointment-type-not-found')
    ).not.toBeInTheDocument();
  });

  it('booking TWICE through the same slug succeeds both times — the slug is never consumed', async () => {
    const user = userEvent.setup();
    vi.mocked(publicBookingAppointmentTypesBookableSlotsList)
      .mockResolvedValueOnce(proposalsOk([PROPOSAL]))
      .mockResolvedValueOnce(proposalsOk([PROPOSAL]));
    vi.mocked(publicBookingAppointmentTypesAvailabilityCreate)
      .mockResolvedValueOnce(availabilityOk(RANGE_AVAILABILITY))
      .mockResolvedValueOnce(availabilityOk(RANGE_AVAILABILITY));
    vi.mocked(publicBookingAppointmentTypesEventsCreate)
      .mockResolvedValueOnce(eventOk(makeEvent({ id: 1 })))
      .mockResolvedValueOnce(eventOk(makeEvent({ id: 2 })));

    // First attendee books through the link.
    const first = renderFlow();
    await pickProposalAndCompleteSlots(user);
    await fillAndSubmitAttendeeForm(user);
    await waitFor(() =>
      expect(screen.getByTestId('booking-confirmation')).toBeInTheDocument()
    );
    first.unmount();

    // A second, independent attendee opens the SAME link afterward.
    renderFlow();
    await pickProposalAndCompleteSlots(user);
    await fillAndSubmitAttendeeForm(user);
    await waitFor(() =>
      expect(screen.getByTestId('booking-confirmation')).toBeInTheDocument()
    );

    expect(
      vi.mocked(publicBookingAppointmentTypesEventsCreate)
    ).toHaveBeenCalledTimes(2);
  });

  it('SLOT_UNAVAILABLE on submit returns to whole-appointment-type time selection with the proposal list refetched', async () => {
    const user = userEvent.setup();
    vi.mocked(publicBookingAppointmentTypesBookableSlotsList)
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
      publicBookingAppointmentTypesAvailabilityCreate
    ).mockResolvedValueOnce(availabilityOk(RANGE_AVAILABILITY));
    vi.mocked(publicBookingAppointmentTypesEventsCreate).mockResolvedValueOnce(
      eventFailed(409, 'SLOT_UNAVAILABLE', 'Slot no longer available')
    );

    renderFlow();

    await pickProposalAndCompleteSlots(user);
    await fillAndSubmitAttendeeForm(user);

    await waitFor(() =>
      expect(
        screen.getByTestId('codeless-appointment-type-slot-unavailable-notice')
      ).toBeInTheDocument()
    );
    expect(screen.getByRole('radio')).toBeInTheDocument();
    expect(
      vi.mocked(publicBookingAppointmentTypesBookableSlotsList)
    ).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['ALREADY_USED', 409, 'already been used'],
    ['EXPIRED', 410, 'has expired'],
  ] as const)(
    '%s (%d) is a terminal, distinct failure on the write — unchanged from the coded flow',
    async (errorCode, status, expectedPhrase) => {
      const user = userEvent.setup();
      vi.mocked(
        publicBookingAppointmentTypesBookableSlotsList
      ).mockResolvedValueOnce(proposalsOk([PROPOSAL]));
      vi.mocked(
        publicBookingAppointmentTypesAvailabilityCreate
      ).mockResolvedValueOnce(availabilityOk(RANGE_AVAILABILITY));
      vi.mocked(
        publicBookingAppointmentTypesEventsCreate
      ).mockResolvedValueOnce(
        eventFailed(status, errorCode, `${errorCode} happened`)
      );

      renderFlow();

      await pickProposalAndCompleteSlots(user);
      await fillAndSubmitAttendeeForm(user);

      await waitFor(() =>
        expect(
          screen.getByTestId('codeless-appointment-type-booking-terminal-error')
        ).toBeInTheDocument()
      );
      expect(
        screen.getByText(new RegExp(expectedPhrase, 'i'))
      ).toBeInTheDocument();
    }
  );

  it("carries Phase 5's management object through to BookingConfirmation unchanged, even on a codeless booking", async () => {
    const user = userEvent.setup();
    vi.mocked(
      publicBookingAppointmentTypesBookableSlotsList
    ).mockResolvedValueOnce(proposalsOk([PROPOSAL]));
    vi.mocked(
      publicBookingAppointmentTypesAvailabilityCreate
    ).mockResolvedValueOnce(availabilityOk(RANGE_AVAILABILITY));
    vi.mocked(publicBookingAppointmentTypesEventsCreate).mockResolvedValueOnce(
      eventOkWithManagement(makeEvent(), {
        reschedule_code: 'fresh-codeless-reschedule-code',
        cancel_code: 'fresh-codeless-cancel-code',
      })
    );

    renderFlow('surgery-team', 'acme');

    await pickProposalAndCompleteSlots(user);
    await fillAndSubmitAttendeeForm(user);

    const rescheduleInput = (await screen.findByTestId(
      'reschedule-link-input'
    )) as HTMLInputElement;
    const cancelInput = screen.getByTestId(
      'cancel-link-input'
    ) as HTMLInputElement;

    expect(rescheduleInput.value).toContain('fresh-codeless-reschedule-code');
    expect(rescheduleInput.value).toContain('/o/acme/book/');
    expect(rescheduleInput.value).toContain('target=appointmentType');
    expect(cancelInput.value).toContain('fresh-codeless-cancel-code');
  });
});
