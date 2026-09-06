/**
 * AppointmentTypeBlockForm tests.
 *
 * Covers:
 * - a one-off block submits without an rrule (create);
 * - toggling repeat on and picking a weekday submits the serialized rule;
 * - `start_time >= end_time` is rejected by the form BEFORE any request --
 *   proven by asserting the create mock is never called, not merely that an
 *   error message appears (a test that only checked the message would still
 *   pass if the request fired anyway alongside it);
 * - edit mode's tri-state rrule_string: leaving recurrence untouched omits
 *   the key from the PATCH body; turning repeat off on a previously
 *   recurring block sends `null`; changing recurrence settings replaces it
 *   with a new serialized string. All three are exercised so none of them
 *   can regress into each other silently.
 * - reason is optional and independently tri-state on update (omitted when
 *   untouched);
 * - a 402 over-limit rejection renders the shared OverLimitAlert inline and
 *   keeps the form's input on screen (no `onSaved` call -- a rejection is
 *   not a save); an unrelated failure the over-limit reader doesn't match
 *   falls through to an ordinary error toast instead.
 * - a block whose rrule carries a BYDAY restriction under a non-WEEKLY freq
 *   (e.g. `FREQ=MONTHLY;BYDAY=MO,WE`) locks the recurrence sub-form instead
 *   of silently dropping BYDAY when an unrelated recurrence field is edited
 *   -- see `isUnrepresentableRecurrence` in appointment-type-block-form.tsx.
 * - `recurrenceUntil` hydrates as a date-only string even when the stored
 *   UNTIL was a full DATE-TIME value.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type {
  AppointmentTypeScopedBlockedTime,
  AppointmentTypeScopedBlockedTimeCreate,
  PatchedAppointmentTypeScopedBlockedTimeUpdate,
} from '@/client';
import { AppointmentTypeBlockForm } from './appointment-type-block-form';

// jsdom polyfills required by Radix UI's Select (pointer-capture APIs it
// doesn't implement) -- same block as booking-form.test.tsx.
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
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    appointmentTypesSlotsBlockedTimesList: vi.fn(),
    appointmentTypesSlotsBlockedTimesCreate: vi.fn(),
    appointmentTypesSlotsBlockedTimesPartialUpdate: vi.fn(),
  };
});

import {
  appointmentTypesSlotsBlockedTimesCreate,
  appointmentTypesSlotsBlockedTimesPartialUpdate,
} from '@/client/sdk.gen';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

function makeBlock(
  overrides: Partial<AppointmentTypeScopedBlockedTime> = {}
): AppointmentTypeScopedBlockedTime {
  return {
    id: 501,
    calendar_id: 42,
    appointment_type_slot_id: 10,
    start_time: '2026-09-01T09:00:00-03:00',
    end_time: '2026-09-01T17:00:00-03:00',
    timezone: 'America/Sao_Paulo',
    reason: 'Conference',
    rrule_string: null,
    is_recurring: false,
    created: '2026-01-01T00:00:00Z',
    modified: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeCreateResponse(block: AppointmentTypeScopedBlockedTime) {
  return {
    data: { block, orphaned_bookings: [] },
    response: new Response(null, { status: 201 }),
  } as unknown as Awaited<
    ReturnType<typeof appointmentTypesSlotsBlockedTimesCreate>
  >;
}

function makeUpdateResponse(block: AppointmentTypeScopedBlockedTime) {
  return {
    data: { block, orphaned_bookings: [] },
    response: new Response(null, { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof appointmentTypesSlotsBlockedTimesPartialUpdate>
  >;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderForm(
  props: Partial<React.ComponentProps<typeof AppointmentTypeBlockForm>> = {}
) {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(
    <AppointmentTypeBlockForm
      appointmentTypeId={1}
      slotId={10}
      calendarId={42}
      {...props}
    />,
    { wrapper }
  );
}

async function fillRequiredFields(
  user: ReturnType<typeof userEvent.setup>,
  { date = '2026-09-01', start = '09:00', end = '17:00' } = {}
) {
  const dateInput = screen.getByLabelText(/date/i);
  await user.clear(dateInput);
  await user.type(dateInput, date);

  const startInput = screen.getByLabelText(/start time/i);
  await user.clear(startInput);
  await user.type(startInput, start);

  const endInput = screen.getByLabelText(/end time/i);
  await user.clear(endInput);
  await user.type(endInput, end);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AppointmentTypeBlockForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('a one-off block submits without an rrule', async () => {
      vi.mocked(appointmentTypesSlotsBlockedTimesCreate).mockResolvedValue(
        makeCreateResponse(makeBlock({ id: 900 }))
      );

      const user = userEvent.setup();
      renderForm();

      await fillRequiredFields(user);
      // Timezone keeps its default (the test environment's own zone) --
      // Radix's Select popover renders all ~400 IANA zones with no
      // jsdom-friendly way to scroll/search it in a unit test, so the other
      // tests below don't drive it either. appointment-type-block-list.test.tsx and
      // the Storybook stories cover the picker with a pre-seeded value.
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      await user.click(screen.getByRole('button', { name: /add block/i }));

      await waitFor(() =>
        expect(appointmentTypesSlotsBlockedTimesCreate).toHaveBeenCalledTimes(1)
      );

      const call = vi.mocked(appointmentTypesSlotsBlockedTimesCreate).mock
        .calls[0]?.[0] as { body: AppointmentTypeScopedBlockedTimeCreate };
      expect('rrule_string' in call.body).toBe(false);
      expect(call.body.calendar).toBe(42);
      expect(call.body.timezone).toBe(timezone);
    });

    it('toggling repeat and picking a weekday submits a serialized rrule', async () => {
      vi.mocked(appointmentTypesSlotsBlockedTimesCreate).mockResolvedValue(
        makeCreateResponse(makeBlock({ id: 901, is_recurring: true }))
      );

      const user = userEvent.setup();
      renderForm();

      await fillRequiredFields(user);
      await user.click(screen.getByText('Repeat this block'));
      // Default frequency is WEEKLY -- pick Tuesday.
      await user.click(await screen.findByLabelText('Tue'));

      await user.click(screen.getByRole('button', { name: /add block/i }));

      await waitFor(() =>
        expect(appointmentTypesSlotsBlockedTimesCreate).toHaveBeenCalledTimes(1)
      );

      const call = vi.mocked(appointmentTypesSlotsBlockedTimesCreate).mock
        .calls[0]?.[0] as { body: AppointmentTypeScopedBlockedTimeCreate };
      expect(call.body.rrule_string).toBe('FREQ=WEEKLY;BYDAY=TU');
    });

    it('reason round-trips into the create body', async () => {
      vi.mocked(appointmentTypesSlotsBlockedTimesCreate).mockResolvedValue(
        makeCreateResponse(makeBlock({ id: 902, reason: 'Conference' }))
      );

      const user = userEvent.setup();
      renderForm();

      await fillRequiredFields(user);
      await user.type(screen.getByLabelText(/reason/i), 'Conference');

      await user.click(screen.getByRole('button', { name: /add block/i }));

      await waitFor(() =>
        expect(appointmentTypesSlotsBlockedTimesCreate).toHaveBeenCalledTimes(1)
      );
      const call = vi.mocked(appointmentTypesSlotsBlockedTimesCreate).mock
        .calls[0]?.[0] as { body: AppointmentTypeScopedBlockedTimeCreate };
      expect(call.body.reason).toBe('Conference');
    });

    it('start_time >= end_time is rejected by the form before any request', async () => {
      const user = userEvent.setup();
      renderForm();

      await fillRequiredFields(user, { start: '17:00', end: '09:00' });

      await user.click(screen.getByRole('button', { name: /add block/i }));

      expect(
        await screen.findByText(/end time must be after start time/i)
      ).toBeInTheDocument();
      // The whole point of client-side validation here: no request fired.
      expect(appointmentTypesSlotsBlockedTimesCreate).not.toHaveBeenCalled();
    });

    it('a 402 over-limit rejection renders the shared alert inline and keeps the input on screen', async () => {
      const overLimitBody = {
        code: 'limit_exceeded',
        resource: 'availability_windows',
        current_usage: 50,
        limit: 50,
        detail: 'Organization is at its limit for availability windows.',
      };
      vi.mocked(appointmentTypesSlotsBlockedTimesCreate).mockImplementation(
        (async () => {
          throw overLimitBody;
        }) as unknown as typeof appointmentTypesSlotsBlockedTimesCreate
      );

      const user = userEvent.setup();
      const onSaved = vi.fn();
      renderForm({ onSaved });

      await fillRequiredFields(user);
      await user.click(screen.getByRole('button', { name: /add block/i }));

      expect(await screen.findByTestId('over-limit-alert')).toBeInTheDocument();
      expect(screen.getByText(/50 of 50 used/)).toBeInTheDocument();
      // The input is still on screen -- this form doesn't close/reset on a
      // rejected write (see the module doc comment on why this renders
      // inline instead of bubbling up like the orphan case).
      expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
      // A rejected write is not a save -- the caller must not be told one
      // happened.
      expect(onSaved).not.toHaveBeenCalled();
    });

    it('a rejection the over-limit reader does not match falls through to an ordinary error toast', async () => {
      vi.mocked(appointmentTypesSlotsBlockedTimesCreate).mockImplementation(
        (async () => {
          throw new Error('simulated write failure');
        }) as unknown as typeof appointmentTypesSlotsBlockedTimesCreate
      );

      const user = userEvent.setup();
      renderForm();

      await fillRequiredFields(user);
      await user.click(screen.getByRole('button', { name: /add block/i }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          'Failed to create blocked time',
          expect.objectContaining({
            description: expect.stringContaining('simulated write failure'),
          })
        )
      );
      // Not misread as an over-limit rejection.
      expect(screen.queryByTestId('over-limit-alert')).not.toBeInTheDocument();
    });
  });

  describe('edit -- tri-state rrule_string and independently-optional reason', () => {
    it('leaving recurrence untouched omits rrule_string from the PATCH body', async () => {
      const existing = makeBlock({
        id: 501,
        rrule_string: 'FREQ=WEEKLY;BYDAY=TU',
        is_recurring: true,
      });
      vi.mocked(
        appointmentTypesSlotsBlockedTimesPartialUpdate
      ).mockResolvedValue(makeUpdateResponse(existing));

      const user = userEvent.setup();
      renderForm({ block: existing });

      // Only touch the reason field -- recurrence is left exactly as loaded.
      const reasonInput = screen.getByLabelText(/reason/i);
      await user.clear(reasonInput);
      await user.type(reasonInput, 'Rescheduled');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() =>
        expect(
          appointmentTypesSlotsBlockedTimesPartialUpdate
        ).toHaveBeenCalledTimes(1)
      );
      const call = vi.mocked(appointmentTypesSlotsBlockedTimesPartialUpdate)
        .mock.calls[0]?.[0] as {
        body: PatchedAppointmentTypeScopedBlockedTimeUpdate;
      };
      expect('rrule_string' in call.body).toBe(false);
      expect(call.body.reason).toBe('Rescheduled');
    });

    it('turning repeat off on a recurring block sends rrule_string: null', async () => {
      const existing = makeBlock({
        id: 501,
        rrule_string: 'FREQ=WEEKLY;BYDAY=TU',
        is_recurring: true,
      });
      vi.mocked(
        appointmentTypesSlotsBlockedTimesPartialUpdate
      ).mockResolvedValue(
        makeUpdateResponse({
          ...existing,
          rrule_string: null,
          is_recurring: false,
        })
      );

      const user = userEvent.setup();
      renderForm({ block: existing });

      await user.click(screen.getByText('Repeat this block'));

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() =>
        expect(
          appointmentTypesSlotsBlockedTimesPartialUpdate
        ).toHaveBeenCalledTimes(1)
      );
      const call = vi.mocked(appointmentTypesSlotsBlockedTimesPartialUpdate)
        .mock.calls[0]?.[0] as {
        body: PatchedAppointmentTypeScopedBlockedTimeUpdate;
      };
      expect('rrule_string' in call.body).toBe(true);
      expect(call.body.rrule_string).toBeNull();
      // reason was never touched -- must still be omitted.
      expect('reason' in call.body).toBe(false);
    });

    it('changing the recurrence settings replaces rrule_string with a new serialized rule', async () => {
      const existing = makeBlock({
        id: 501,
        rrule_string: 'FREQ=WEEKLY;BYDAY=TU',
        is_recurring: true,
      });
      vi.mocked(
        appointmentTypesSlotsBlockedTimesPartialUpdate
      ).mockResolvedValue(
        makeUpdateResponse({
          ...existing,
          rrule_string: 'FREQ=WEEKLY;BYDAY=TH',
        })
      );

      const user = userEvent.setup();
      renderForm({ block: existing });

      // Uncheck Tuesday, check Thursday.
      await user.click(await screen.findByLabelText('Tue'));
      await user.click(screen.getByLabelText('Thu'));

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() =>
        expect(
          appointmentTypesSlotsBlockedTimesPartialUpdate
        ).toHaveBeenCalledTimes(1)
      );
      const call = vi.mocked(appointmentTypesSlotsBlockedTimesPartialUpdate)
        .mock.calls[0]?.[0] as {
        body: PatchedAppointmentTypeScopedBlockedTimeUpdate;
      };
      expect(call.body.rrule_string).toBe('FREQ=WEEKLY;BYDAY=TH');
    });

    it('a FREQ=MONTHLY;BYDAY=MO,WE block locks recurrence editing and never loses BYDAY', async () => {
      const existing = makeBlock({
        id: 501,
        rrule_string: 'FREQ=MONTHLY;BYDAY=MO,WE',
        is_recurring: true,
      });
      vi.mocked(
        appointmentTypesSlotsBlockedTimesPartialUpdate
      ).mockResolvedValue(makeUpdateResponse(existing));

      const user = userEvent.setup();
      renderForm({ block: existing });

      // This shape can't be safely edited here -- BYDAY is only rendered/
      // re-emitted for WEEKLY, so this rrule cannot round-trip through the
      // sub-form. The lock notice is shown and the "Every"/interval control
      // -- visible and editable for every OTHER frequency -- is disabled.
      expect(screen.getByTestId('block-recurrence-locked')).toBeInTheDocument();
      const intervalInput = screen.getByLabelText(/every/i);
      expect(intervalInput).toBeDisabled();

      // Attempting to edit the (disabled) interval control must not be able
      // to mark recurrence dirty and rewrite the rule with BYDAY dropped.
      await user.click(intervalInput);
      await user.keyboard('3');

      await user.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() =>
        expect(
          appointmentTypesSlotsBlockedTimesPartialUpdate
        ).toHaveBeenCalledTimes(1)
      );
      const call = vi.mocked(appointmentTypesSlotsBlockedTimesPartialUpdate)
        .mock.calls[0]?.[0] as {
        body: PatchedAppointmentTypeScopedBlockedTimeUpdate;
      };
      // Untouched (disabled) recurrence -- rrule_string omitted, not
      // rewritten without the BYDAY restriction.
      expect('rrule_string' in call.body).toBe(false);
    });

    it('recurrenceUntil hydrates as a date-only string from a DATE-TIME UNTIL', async () => {
      const existing = makeBlock({
        id: 502,
        rrule_string: 'FREQ=WEEKLY;BYDAY=MO;UNTIL=20261231T120000Z',
        is_recurring: true,
      });

      renderForm({ block: existing });

      // recurrenceEndType hydrates to 'on-date' whenever `until` is set, so
      // the End date field renders without any interaction.
      expect(await screen.findByLabelText(/end date/i)).toHaveValue(
        '2026-12-31'
      );
    });
  });
});
