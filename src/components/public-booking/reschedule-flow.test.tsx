/**
 * RescheduleFlow + CancelFlow integration tests (Phase 4 spec names both in
 * this one file: "a valid reschedule link shows slots and reschedules; a
 * cancel link confirms and cancels on 204").
 *
 * Covers:
 * - RescheduleFlow: slots render for a calendar-scoped link; selecting one
 *   and confirming calls `publicBookingEventsRescheduleCreate` with times
 *   only and renders the confirmation.
 * - RescheduleFlow: a group-scoped link (`?target=group`) reads via the
 *   group endpoint and reschedules via `publicBookingGroupEventsRescheduleCreate`
 *   — the single-calendar endpoints are NEVER called for it (no probing).
 * - RescheduleFlow: an opaque 403 on the slot read renders `link-invalid`.
 * - RescheduleFlow: `SLOT_UNAVAILABLE` on confirm returns to slot selection
 *   with the list refetched.
 * - RescheduleFlow: `ALREADY_USED` is terminal and worded distinctly from
 *   the opaque `link-invalid` copy.
 * - RescheduleFlow: renders no editable title, description, or attendee
 *   field anywhere in the flow.
 * - CancelFlow: confirming calls `publicBookingEventsCancelCreate` and
 *   renders the cancelled state on `204`.
 * - CancelFlow: `ALREADY_USED` is terminal and worded distinctly from
 *   RescheduleFlow's opaque `link-invalid` copy.
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

// ---------------------------------------------------------------------------
// Mocks — declared before any import that uses them.
// ---------------------------------------------------------------------------

let currentSearch = new URLSearchParams({
  target: 'calendar',
  duration: '1800',
});
vi.mock('next/navigation', () => ({
  useSearchParams: () => currentSearch,
}));

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    publicBookingCalendarBookableSlotsList: vi.fn(),
    publicBookingCalendarGroupBookableSlotsList: vi.fn(),
    publicBookingEventsRescheduleCreate: vi.fn(),
    publicBookingGroupEventsRescheduleCreate: vi.fn(),
    publicBookingEventsCancelCreate: vi.fn(),
  };
});

import {
  publicBookingCalendarBookableSlotsList,
  publicBookingCalendarGroupBookableSlotsList,
  publicBookingEventsRescheduleCreate,
  publicBookingGroupEventsRescheduleCreate,
  publicBookingEventsCancelCreate,
} from '@/client/sdk.gen';
import type { BookableSlotProposal, CalendarEvent } from '@/client';
import { RescheduleFlow } from './reschedule-flow';
import { CancelFlow } from './cancel-flow';

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

function renderReschedule(code = 'secret-code', slug?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return {
    ...render(<RescheduleFlow code={code} slug={slug} />, { wrapper: Wrapper }),
    queryClient,
  };
}

function renderCancel(code = 'secret-code') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<CancelFlow code={code} />, { wrapper: Wrapper });
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
  currentSearch = new URLSearchParams({ target: 'calendar', duration: '1800' });
});

describe('RescheduleFlow', () => {
  it('shows slots for a calendar-scoped link, and confirming reschedules with times only', async () => {
    const user = userEvent.setup();
    vi.mocked(publicBookingCalendarBookableSlotsList).mockResolvedValueOnce(
      slotsOk([
        {
          start_time: '2026-03-02T14:00:00.000Z',
          end_time: '2026-03-02T14:30:00.000Z',
        },
      ])
    );
    vi.mocked(publicBookingEventsRescheduleCreate).mockResolvedValueOnce({
      data: makeEvent({
        start_time: '2026-03-02T14:00:00.000Z',
        end_time: '2026-03-02T14:30:00.000Z',
      }),
      response: new Response('{}', { status: 201 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingEventsRescheduleCreate>
    >);

    renderReschedule();

    await selectFirstSlot(user);
    await user.click(screen.getByTestId('reschedule-confirm'));

    await waitFor(() =>
      expect(screen.getByTestId('booking-confirmation')).toBeInTheDocument()
    );

    expect(publicBookingEventsRescheduleCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'X-Booking-Code': 'secret-code' },
        body: {
          start_time: '2026-03-02T14:00:00.000Z',
          end_time: '2026-03-02T14:30:00.000Z',
          timezone: expect.any(String),
        },
      })
    );
    expect(publicBookingGroupEventsRescheduleCreate).not.toHaveBeenCalled();
  });

  it('a group-scoped link (?target=group) reads and writes via the GROUP endpoints only — the single-calendar endpoints are never called (no probing)', async () => {
    currentSearch = new URLSearchParams({ target: 'group' });
    const user = userEvent.setup();
    vi.mocked(
      publicBookingCalendarGroupBookableSlotsList
    ).mockResolvedValueOnce({
      data: [
        {
          start_time: '2026-03-05T09:00:00.000Z',
          end_time: '2026-03-05T09:45:00.000Z',
        },
      ],
      response: new Response('{}', { status: 200 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingCalendarGroupBookableSlotsList>
    >);
    vi.mocked(publicBookingGroupEventsRescheduleCreate).mockResolvedValueOnce({
      data: makeEvent({
        start_time: '2026-03-05T09:00:00.000Z',
        end_time: '2026-03-05T09:45:00.000Z',
      }),
      response: new Response('{}', { status: 201 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingGroupEventsRescheduleCreate>
    >);

    renderReschedule('group-secret');

    await selectFirstSlot(user);
    await user.click(screen.getByTestId('reschedule-confirm'));

    await waitFor(() =>
      expect(screen.getByTestId('booking-confirmation')).toBeInTheDocument()
    );

    expect(publicBookingGroupEventsRescheduleCreate).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { 'X-Booking-Code': 'group-secret' } })
    );
    expect(publicBookingCalendarBookableSlotsList).not.toHaveBeenCalled();
    expect(publicBookingEventsRescheduleCreate).not.toHaveBeenCalled();
  });

  it('renders the opaque link-invalid state on a 403 read failure, never "expired" or "already used" wording', async () => {
    vi.mocked(publicBookingCalendarBookableSlotsList).mockResolvedValueOnce(
      slotsFailed(403, { detail: 'This booking code has expired.' })
    );

    renderReschedule();

    await waitFor(() =>
      expect(screen.getByTestId('link-invalid')).toBeInTheDocument()
    );
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toMatch(/expired/i);
    expect(bodyText).not.toMatch(/already used/i);
  });

  it('SLOT_UNAVAILABLE on confirm returns to slot selection with the list refetched', async () => {
    const user = userEvent.setup();
    vi.mocked(publicBookingCalendarBookableSlotsList)
      .mockResolvedValueOnce(
        slotsOk([
          {
            start_time: '2026-03-02T14:00:00.000Z',
            end_time: '2026-03-02T14:30:00.000Z',
          },
        ])
      )
      .mockResolvedValueOnce(
        slotsOk([
          {
            start_time: '2026-03-03T15:00:00.000Z',
            end_time: '2026-03-03T15:30:00.000Z',
          },
        ])
      );
    const failureBody = {
      error_code: 'SLOT_UNAVAILABLE',
      detail: 'Slot no longer available',
    };
    vi.mocked(publicBookingEventsRescheduleCreate).mockResolvedValueOnce({
      data: undefined,
      error: failureBody,
      response: new Response(JSON.stringify(failureBody), { status: 409 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingEventsRescheduleCreate>
    >);

    renderReschedule();

    await selectFirstSlot(user);
    await user.click(screen.getByTestId('reschedule-confirm'));

    await waitFor(() =>
      expect(
        screen.getByTestId('reschedule-slot-unavailable-notice')
      ).toBeInTheDocument()
    );
    expect(screen.getByRole('radio')).toBeInTheDocument();
    expect(publicBookingCalendarBookableSlotsList).toHaveBeenCalledTimes(2);
  });

  it('ALREADY_USED is terminal, worded distinctly from the opaque link-invalid copy', async () => {
    const user = userEvent.setup();
    vi.mocked(publicBookingCalendarBookableSlotsList).mockResolvedValueOnce(
      slotsOk([
        {
          start_time: '2026-03-02T14:00:00.000Z',
          end_time: '2026-03-02T14:30:00.000Z',
        },
      ])
    );
    const failureBody = {
      error_code: 'ALREADY_USED',
      detail: 'This booking code has already been used.',
    };
    vi.mocked(publicBookingEventsRescheduleCreate).mockResolvedValueOnce({
      data: undefined,
      error: failureBody,
      response: new Response(JSON.stringify(failureBody), { status: 409 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingEventsRescheduleCreate>
    >);

    renderReschedule();

    await selectFirstSlot(user);
    await user.click(screen.getByTestId('reschedule-confirm'));

    await waitFor(() =>
      expect(
        screen.getByTestId('reschedule-terminal-error')
      ).toBeInTheDocument()
    );
    const cardText = screen.getByTestId(
      'reschedule-terminal-error'
    ).textContent;
    expect(cardText).toMatch(/already been used/i);
    // Distinct from the opaque invalid-link wording used elsewhere.
    expect(cardText).not.toMatch(/no longer valid/i);
    expect(screen.queryByTestId('link-invalid')).not.toBeInTheDocument();
  });

  it('exposes no editable title, description, or attendee field anywhere in the flow', async () => {
    const user = userEvent.setup();
    vi.mocked(publicBookingCalendarBookableSlotsList).mockResolvedValueOnce(
      slotsOk([
        {
          start_time: '2026-03-02T14:00:00.000Z',
          end_time: '2026-03-02T14:30:00.000Z',
        },
      ])
    );

    renderReschedule();
    await selectFirstSlot(user);

    // Now on the confirm step — assert none of the fields the endpoint
    // would ignore (title, description, attendee/email/name) are rendered.
    expect(screen.queryByLabelText(/title/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/description/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('attendee-name-input')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('attendee-email-input')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------
  // Phase 5 — the reschedule write re-issues a FRESH pair of self-service
  // links, so the chain continues.
  // ---------------------------------------------------------------------

  it("renders a FRESH pair of reschedule/cancel links (calendar-scoped) from its own write's management object", async () => {
    const user = userEvent.setup();
    vi.mocked(publicBookingCalendarBookableSlotsList).mockResolvedValueOnce(
      slotsOk([
        {
          start_time: '2026-03-02T14:00:00.000Z',
          end_time: '2026-03-02T14:30:00.000Z',
        },
      ])
    );
    const rescheduledEvent = {
      ...makeEvent({
        start_time: '2026-03-02T14:00:00.000Z',
        end_time: '2026-03-02T14:30:00.000Z',
      }),
      management: {
        reschedule_code: 'second-hop-reschedule-code',
        cancel_code: 'second-hop-cancel-code',
      },
    };
    vi.mocked(publicBookingEventsRescheduleCreate).mockResolvedValueOnce({
      data: rescheduledEvent,
      response: new Response(JSON.stringify(rescheduledEvent), {
        status: 201,
      }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingEventsRescheduleCreate>
    >);

    renderReschedule('secret-code', 'acme');

    await selectFirstSlot(user);
    await user.click(screen.getByTestId('reschedule-confirm'));

    const rescheduleInput = (await screen.findByTestId(
      'reschedule-link-input'
    )) as HTMLInputElement;
    const cancelInput = screen.getByTestId(
      'cancel-link-input'
    ) as HTMLInputElement;

    // A FRESH pair, distinct from whatever code got the attendee to this
    // page — the chain continues rather than reusing the consumed code.
    expect(rescheduleInput.value).toContain('second-hop-reschedule-code');
    expect(rescheduleInput.value).not.toContain('secret-code');
    expect(rescheduleInput.value).toContain('/o/acme/book/');
    expect(rescheduleInput.value).toContain('target=calendar');
    expect(cancelInput.value).toContain('second-hop-cancel-code');
  });

  it('renders a FRESH pair of links with ?target=group (no duration) for a group-scoped reschedule', async () => {
    currentSearch = new URLSearchParams({ target: 'group' });
    const user = userEvent.setup();
    vi.mocked(
      publicBookingCalendarGroupBookableSlotsList
    ).mockResolvedValueOnce({
      data: [
        {
          start_time: '2026-03-05T09:00:00.000Z',
          end_time: '2026-03-05T09:45:00.000Z',
        },
      ],
      response: new Response('{}', { status: 200 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingCalendarGroupBookableSlotsList>
    >);
    const rescheduledEvent = {
      ...makeEvent({
        start_time: '2026-03-05T09:00:00.000Z',
        end_time: '2026-03-05T09:45:00.000Z',
      }),
      management: {
        reschedule_code: 'group-second-hop-reschedule-code',
        cancel_code: 'group-second-hop-cancel-code',
      },
    };
    vi.mocked(publicBookingGroupEventsRescheduleCreate).mockResolvedValueOnce({
      data: rescheduledEvent,
      response: new Response(JSON.stringify(rescheduledEvent), {
        status: 201,
      }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingGroupEventsRescheduleCreate>
    >);

    renderReschedule('group-secret');

    await selectFirstSlot(user);
    await user.click(screen.getByTestId('reschedule-confirm'));

    const rescheduleInput = (await screen.findByTestId(
      'reschedule-link-input'
    )) as HTMLInputElement;
    expect(rescheduleInput.value).toContain('group-second-hop-reschedule-code');
    expect(rescheduleInput.value).toContain('target=group');
    expect(rescheduleInput.value).not.toContain('duration=');
  });

  it('a 201 with no management object (an older backend) degrades to the plain confirmation, no crash', async () => {
    const user = userEvent.setup();
    vi.mocked(publicBookingCalendarBookableSlotsList).mockResolvedValueOnce(
      slotsOk([
        {
          start_time: '2026-03-02T14:00:00.000Z',
          end_time: '2026-03-02T14:30:00.000Z',
        },
      ])
    );
    vi.mocked(publicBookingEventsRescheduleCreate).mockResolvedValueOnce({
      data: makeEvent({
        start_time: '2026-03-02T14:00:00.000Z',
        end_time: '2026-03-02T14:30:00.000Z',
      }),
      response: new Response('{}', { status: 201 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingEventsRescheduleCreate>
    >);

    renderReschedule();

    await selectFirstSlot(user);
    await user.click(screen.getByTestId('reschedule-confirm'));

    await waitFor(() =>
      expect(screen.getByTestId('booking-confirmation')).toBeInTheDocument()
    );
    expect(
      screen.queryByTestId('booking-management-links')
    ).not.toBeInTheDocument();
  });

  it('the fresh management codes are gone from the mutation cache after unmount', async () => {
    const user = userEvent.setup();
    vi.mocked(publicBookingCalendarBookableSlotsList).mockResolvedValueOnce(
      slotsOk([
        {
          start_time: '2026-03-02T14:00:00.000Z',
          end_time: '2026-03-02T14:30:00.000Z',
        },
      ])
    );
    const rescheduledEvent = {
      ...makeEvent({
        start_time: '2026-03-02T14:00:00.000Z',
        end_time: '2026-03-02T14:30:00.000Z',
      }),
      management: {
        reschedule_code: 'reschedule-gone-after-unmount',
        cancel_code: 'cancel-gone-after-unmount',
      },
    };
    vi.mocked(publicBookingEventsRescheduleCreate).mockResolvedValueOnce({
      data: rescheduledEvent,
      response: new Response(JSON.stringify(rescheduledEvent), {
        status: 201,
      }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingEventsRescheduleCreate>
    >);

    const { unmount, queryClient } = renderReschedule();

    await selectFirstSlot(user);
    await user.click(screen.getByTestId('reschedule-confirm'));
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
                'reschedule-gone-after-unmount'
              ) &&
              !JSON.stringify(m.state.data ?? '').includes(
                'cancel-gone-after-unmount'
              )
          )
      ).toBe(true);
    });
  });
});

describe('CancelFlow', () => {
  it('confirming cancels and renders the cancelled state on a 204', async () => {
    const user = userEvent.setup();
    vi.mocked(publicBookingEventsCancelCreate).mockResolvedValueOnce({
      data: undefined,
      response: new Response(null, { status: 204 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingEventsCancelCreate>
    >);

    renderCancel();

    await user.click(screen.getByTestId('cancel-confirm-button'));

    await waitFor(() =>
      expect(screen.getByTestId('cancel-confirmation')).toBeInTheDocument()
    );
    expect(publicBookingEventsCancelCreate).toHaveBeenCalledWith(
      expect.objectContaining({ headers: { 'X-Booking-Code': 'secret-code' } })
    );
    // Cancel returns 204 and issues nothing — no further self-service link,
    // and no `BookingConfirmation` (which requires an event the cancel
    // response never returns).
    expect(
      screen.queryByTestId('booking-management-links')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('reschedule-link-input')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('cancel-link-input')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('booking-confirmation')
    ).not.toBeInTheDocument();
  });

  it("ALREADY_USED is terminal, worded distinctly from RescheduleFlow's opaque link-invalid copy", async () => {
    const user = userEvent.setup();
    const failureBody = {
      error_code: 'ALREADY_USED',
      detail: 'This booking code has already been used.',
    };
    vi.mocked(publicBookingEventsCancelCreate).mockResolvedValueOnce({
      data: undefined,
      error: failureBody,
      response: new Response(JSON.stringify(failureBody), { status: 409 }),
    } as unknown as Awaited<
      ReturnType<typeof publicBookingEventsCancelCreate>
    >);

    renderCancel();
    await user.click(screen.getByTestId('cancel-confirm-button'));

    await waitFor(() =>
      expect(screen.getByTestId('cancel-terminal-error')).toBeInTheDocument()
    );
    const cardText = screen.getByTestId('cancel-terminal-error').textContent;
    expect(cardText).toMatch(/already been used/i);
    expect(cardText).not.toMatch(/no longer valid/i);
  });
});
