/**
 * PublicAppointmentTypeBookingFlow integration tests.
 *
 * Covers (per the phase spec):
 * - Whole-appointment type proposals render; picking one loads per-slot availability
 *   and renders the server-pinned duration read off the SELECTED
 *   PROPOSAL's own span — never a client-requested value (the appointment type flow
 *   sends no duration of its own to the write, and the read's
 *   `duration_seconds` is a fixed technical placeholder, never
 *   user-configurable).
 * - A complete, satisfiable selection books with the right `slot_selections`
 *   and confirms.
 * - An opaque 403 on EITHER read (proposals or per-range availability)
 *   renders the one `link-invalid` state.
 * - `409 SLOT_UNAVAILABLE` on submit returns all the way to whole-appointment-type time
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
    publicBookingAppointmentTypeBookableSlotsList: vi.fn(),
    publicBookingAppointmentTypeAvailabilityCreate: vi.fn(),
    publicBookingAppointmentTypesEventsCreate: vi.fn(),
  };
});

import {
  publicBookingAppointmentTypeBookableSlotsList,
  publicBookingAppointmentTypeAvailabilityCreate,
  publicBookingAppointmentTypesEventsCreate,
} from '@/client/sdk.gen';
import type {
  BookableSlotProposal,
  CalendarEvent,
  AppointmentTypeRangeAvailability,
} from '@/client';
import { PublicAppointmentTypeBookingFlow } from './public-appointment-type-booking-flow';

function proposalsOk(
  proposals: BookableSlotProposal[]
): Awaited<ReturnType<typeof publicBookingAppointmentTypeBookableSlotsList>> {
  return {
    data: proposals,
    response: new Response(JSON.stringify(proposals), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingAppointmentTypeBookableSlotsList>
  >;
}

function proposalsFailed(
  status: number,
  body: unknown = { detail: 'Invalid or expired code.' }
): Awaited<ReturnType<typeof publicBookingAppointmentTypeBookableSlotsList>> {
  return {
    data: undefined,
    error: body,
    response: new Response(JSON.stringify(body), { status }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingAppointmentTypeBookableSlotsList>
  >;
}

function availabilityOk(
  range: AppointmentTypeRangeAvailability
): Awaited<ReturnType<typeof publicBookingAppointmentTypeAvailabilityCreate>> {
  const body = { count: 1, results: [range] };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingAppointmentTypeAvailabilityCreate>
  >;
}

function availabilityFailed(
  status: number,
  body: unknown = { detail: 'Invalid or expired code.' }
): Awaited<ReturnType<typeof publicBookingAppointmentTypeAvailabilityCreate>> {
  return {
    data: undefined,
    error: body,
    response: new Response(JSON.stringify(body), { status }),
  } as unknown as Awaited<
    ReturnType<typeof publicBookingAppointmentTypeAvailabilityCreate>
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
  end_time: '2026-03-02T10:45:00.000Z', // 45 min — proves the render uses the proposal's own span
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

function renderFlow(code = 'secret-code', slug?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return {
    ...render(<PublicAppointmentTypeBookingFlow code={code} slug={slug} />, {
      wrapper: Wrapper,
    }),
    queryClient,
  };
}

async function pickProposalAndCompleteSlots(
  user: ReturnType<typeof userEvent.setup>
) {
  // `findAllByRole` — a day with 2+ proposals renders multiple radios, and
  // `findByRole` (singular) throws "found multiple elements" instead of
  // selecting the first one.
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

describe('PublicAppointmentTypeBookingFlow', () => {
  it('renders whole-appointment-type proposals and, once one is picked, renders the PROPOSAL length, never a locally requested one', async () => {
    const user = userEvent.setup();
    vi.mocked(
      publicBookingAppointmentTypeBookableSlotsList
    ).mockResolvedValueOnce(proposalsOk([PROPOSAL]));
    vi.mocked(
      publicBookingAppointmentTypeAvailabilityCreate
    ).mockResolvedValueOnce(availabilityOk(RANGE_AVAILABILITY));

    renderFlow();

    // `findAllByRole` — a day with 2+ proposals renders multiple radios, and
    // `findByRole` (singular) throws "found multiple elements" instead of
    // selecting the first one.
    const [radio] = await screen.findAllByRole('radio');
    await user.click(radio);

    await waitFor(() =>
      expect(screen.getByText('45 min appointment')).toBeInTheDocument()
    );
    // The read still had to carry SOME duration_seconds (required by the
    // endpoint), but it is never surfaced — only the request itself.
    expect(
      vi.mocked(publicBookingAppointmentTypeBookableSlotsList)
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          duration_seconds: expect.any(Number),
        }),
      })
    );
  });

  it('an appointment type with no pinned duration renders the placeholder length verbatim, unmodified by the server', async () => {
    const user = userEvent.setup();
    // No `AppointmentType.duration` pinned: the server does not override
    // `duration_seconds`, so the returned proposal's span comes back
    // exactly equal to the read placeholder
    // (`APPOINTMENT_TYPE_SLOTS_READ_DURATION_PLACEHOLDER_SECONDS` = 1800s = 30min).
    // Minting a link for an appointment type in this state is refused at the source
    // (see `mint-booking-link-dialog.tsx`'s `appointmentTypeDurationIsUnset`), but
    // this pins down what the flow itself renders on that placeholder path.
    const unpinnedDurationProposal: BookableSlotProposal = {
      start_time: '2026-03-02T10:00:00.000Z',
      end_time: '2026-03-02T10:30:00.000Z',
    };
    vi.mocked(
      publicBookingAppointmentTypeBookableSlotsList
    ).mockResolvedValueOnce(proposalsOk([unpinnedDurationProposal]));
    vi.mocked(
      publicBookingAppointmentTypeAvailabilityCreate
    ).mockResolvedValueOnce(
      availabilityOk({
        start_time: unpinnedDurationProposal.start_time,
        end_time: unpinnedDurationProposal.end_time,
        slots: RANGE_AVAILABILITY.slots,
      })
    );

    renderFlow();

    // `findAllByRole` — a day with 2+ proposals renders multiple radios, and
    // `findByRole` (singular) throws "found multiple elements" instead of
    // selecting the first one.
    const [radio] = await screen.findAllByRole('radio');
    await user.click(radio);

    await waitFor(() =>
      expect(screen.getByText('30 min appointment')).toBeInTheDocument()
    );
    expect(
      vi.mocked(publicBookingAppointmentTypeBookableSlotsList)
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({ duration_seconds: 1800 }),
      })
    );
  });

  it('a satisfiable selection books with the right slot_selections and confirms', async () => {
    const user = userEvent.setup();
    vi.mocked(
      publicBookingAppointmentTypeBookableSlotsList
    ).mockResolvedValueOnce(proposalsOk([PROPOSAL]));
    vi.mocked(
      publicBookingAppointmentTypeAvailabilityCreate
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
    expect(
      vi.mocked(publicBookingAppointmentTypesEventsCreate)
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
      publicBookingAppointmentTypeBookableSlotsList
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
      publicBookingAppointmentTypeBookableSlotsList
    ).mockResolvedValueOnce(proposalsOk([PROPOSAL]));
    vi.mocked(
      publicBookingAppointmentTypeAvailabilityCreate
    ).mockResolvedValueOnce(availabilityFailed(403));

    renderFlow();

    // `findAllByRole` — a day with 2+ proposals renders multiple radios, and
    // `findByRole` (singular) throws "found multiple elements" instead of
    // selecting the first one.
    const [radio] = await screen.findAllByRole('radio');
    await user.click(radio);

    await waitFor(() =>
      expect(screen.getByTestId('link-invalid')).toBeInTheDocument()
    );
  });

  it('SLOT_UNAVAILABLE on submit returns to whole-appointment-type time selection with the proposal list refetched', async () => {
    const user = userEvent.setup();
    vi.mocked(publicBookingAppointmentTypeBookableSlotsList)
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
      publicBookingAppointmentTypeAvailabilityCreate
    ).mockResolvedValueOnce(availabilityOk(RANGE_AVAILABILITY));
    vi.mocked(publicBookingAppointmentTypesEventsCreate).mockResolvedValueOnce(
      eventFailed(409, 'SLOT_UNAVAILABLE', 'Slot no longer available')
    );

    renderFlow();

    await pickProposalAndCompleteSlots(user);
    await fillAndSubmitAttendeeForm(user);

    await waitFor(() =>
      expect(
        screen.getByTestId('appointment-type-slot-unavailable-notice')
      ).toBeInTheDocument()
    );
    expect(screen.getByRole('radio')).toBeInTheDocument();
    expect(
      vi.mocked(publicBookingAppointmentTypeBookableSlotsList)
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
        publicBookingAppointmentTypeBookableSlotsList
      ).mockResolvedValueOnce(proposalsOk([PROPOSAL]));
      vi.mocked(
        publicBookingAppointmentTypeAvailabilityCreate
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
          screen.getByTestId('appointment-type-booking-terminal-error')
        ).toBeInTheDocument()
      );
      expect(
        within(
          screen.getByTestId('appointment-type-booking-terminal-error')
        ).getByText(new RegExp(expectedPhrase, 'i'))
      ).toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    }
  );

  // ---------------------------------------------------------------------
  // Phase 5 — self-service management links on the confirmation
  // ---------------------------------------------------------------------

  it("renders working, appointment-type-scoped (no duration) reschedule and cancel links from the write's management object", async () => {
    const user = userEvent.setup();
    vi.mocked(
      publicBookingAppointmentTypeBookableSlotsList
    ).mockResolvedValueOnce(proposalsOk([PROPOSAL]));
    vi.mocked(
      publicBookingAppointmentTypeAvailabilityCreate
    ).mockResolvedValueOnce(availabilityOk(RANGE_AVAILABILITY));
    vi.mocked(publicBookingAppointmentTypesEventsCreate).mockResolvedValueOnce(
      eventOkWithManagement(makeEvent(), {
        reschedule_code: 'fresh-appointment-type-reschedule-code',
        cancel_code: 'fresh-appointment-type-cancel-code',
      })
    );

    renderFlow('secret-code', 'acme');

    await pickProposalAndCompleteSlots(user);
    await fillAndSubmitAttendeeForm(user);

    const rescheduleInput = (await screen.findByTestId(
      'reschedule-link-input'
    )) as HTMLInputElement;
    const cancelInput = screen.getByTestId(
      'cancel-link-input'
    ) as HTMLInputElement;

    expect(rescheduleInput.value).toContain(
      'fresh-appointment-type-reschedule-code'
    );
    expect(rescheduleInput.value).toContain('/o/acme/book/');
    expect(rescheduleInput.value).toContain('target=appointmentType');
    expect(rescheduleInput.value).not.toContain('duration=');
    expect(cancelInput.value).toContain('fresh-appointment-type-cancel-code');
  });

  it('a 201 with no management object (an older backend) degrades to the plain confirmation, no crash', async () => {
    const user = userEvent.setup();
    vi.mocked(
      publicBookingAppointmentTypeBookableSlotsList
    ).mockResolvedValueOnce(proposalsOk([PROPOSAL]));
    vi.mocked(
      publicBookingAppointmentTypeAvailabilityCreate
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
    expect(
      screen.queryByTestId('booking-management-links')
    ).not.toBeInTheDocument();
  });

  it('the plaintext management codes are gone from the mutation cache after unmount', async () => {
    const user = userEvent.setup();
    vi.mocked(
      publicBookingAppointmentTypeBookableSlotsList
    ).mockResolvedValueOnce(proposalsOk([PROPOSAL]));
    vi.mocked(
      publicBookingAppointmentTypeAvailabilityCreate
    ).mockResolvedValueOnce(availabilityOk(RANGE_AVAILABILITY));
    vi.mocked(publicBookingAppointmentTypesEventsCreate).mockResolvedValueOnce(
      eventOkWithManagement(makeEvent(), {
        reschedule_code: 'appointment-type-gone-after-unmount-reschedule',
        cancel_code: 'appointment-type-gone-after-unmount-cancel',
      })
    );

    const { unmount, queryClient } = renderFlow();

    await pickProposalAndCompleteSlots(user);
    await fillAndSubmitAttendeeForm(user);

    await screen.findByTestId('reschedule-link-input');

    unmount();

    // See `public-booking-flow.test.tsx`'s identical regression test for why
    // this must be awaited (`gcTime: 0` still removes on a 0ms timer).
    await waitFor(() => {
      expect(
        queryClient
          .getMutationCache()
          .getAll()
          .every(
            (m) =>
              !JSON.stringify(m.state.data ?? '').includes(
                'appointment-type-gone-after-unmount-reschedule'
              ) &&
              !JSON.stringify(m.state.data ?? '').includes(
                'appointment-type-gone-after-unmount-cancel'
              )
          )
      ).toBe(true);
    });
  });
});
