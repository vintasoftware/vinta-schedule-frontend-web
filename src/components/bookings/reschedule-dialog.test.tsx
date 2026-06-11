/**
 * RescheduleDialog tests.
 *
 * Covers:
 *  - End-after-start validation: shows error when end <= start.
 *  - Conflict detected → ConflictSurface is shown.
 *  - Override ("Book anyway") → rescheduleBooking is called.
 *  - Recurring event → ScopePromptDialog is shown after check.
 *  - Non-recurring event → NO ScopePromptDialog.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { DateTime } from 'luxon';

// ---------------------------------------------------------------------------
// jsdom polyfills for Radix UI
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
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarEventsPartialUpdate: vi.fn(),
    calendarEventsCreateExceptionCreate: vi.fn(),
    calendarEventsBulkModifyCreate: vi.fn(),
    calendarAvailableWindowsList: vi.fn(),
    calendarUnavailableWindowsList: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/events',
  useSearchParams: () => new URLSearchParams(),
}));

import {
  calendarEventsPartialUpdate,
  calendarUnavailableWindowsList,
  calendarAvailableWindowsList,
} from '@/client/sdk.gen';
import { RescheduleDialog } from './reschedule-dialog';
import type { CalendarEventVM } from '@/components/calendar/event-vm';
import type { CalendarEvent } from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRaw(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 42,
    title: 'Team Meeting',
    start_time: '2024-06-15T09:00:00-04:00',
    end_time: '2024-06-15T10:00:00-04:00',
    timezone: 'America/New_York',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    external_id: 'ext-42',
    external_attendances: [],
    attendances: [],
    resource_allocations: [],
    parent_recurring_object: {
      id: 0,
      title: '',
      external_id: '',
      start_time: '2024-01-01T00:00:00Z',
      end_time: '2024-01-01T00:00:00Z',
      created: '2024-01-01T00:00:00Z',
      modified: '2024-01-01T00:00:00Z',
    },
    is_recurring: false,
    is_recurring_instance: false,
    ...overrides,
  };
}

function makeEventVM(
  overrides: Partial<CalendarEventVM> = {}
): CalendarEventVM {
  const raw = makeRaw();
  const zone = 'America/New_York';
  const startDt = DateTime.fromISO(raw.start_time, { zone });
  const endDt = DateTime.fromISO(raw.end_time, { zone });
  return {
    id: String(raw.id),
    title: raw.title,
    start: startDt.toJSDate(),
    end: endDt.toJSDate(),
    startDt,
    endDt,
    timezone: zone,
    timezoneLabel: 'EDT (UTC-4)',
    calendarId: 1,
    isRecurring: false,
    isRecurringException: false,
    status: 'confirmed',
    _raw: raw,
    ...overrides,
  };
}

function makeRecurringEventVM(
  overrides: Partial<CalendarEventVM> = {}
): CalendarEventVM {
  const raw = makeRaw({ is_recurring: true, is_recurring_instance: true });
  const zone = 'America/New_York';
  const startDt = DateTime.fromISO(raw.start_time, { zone });
  const endDt = DateTime.fromISO(raw.end_time, { zone });
  return {
    id: String(raw.id),
    title: raw.title,
    start: startDt.toJSDate(),
    end: endDt.toJSDate(),
    startDt,
    endDt,
    timezone: zone,
    timezoneLabel: 'EDT (UTC-4)',
    calendarId: 1,
    isRecurring: true,
    isRecurringException: false,
    status: 'confirmed',
    _raw: raw,
    ...overrides,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeUnavailableResponse(hasConflict: boolean): any {
  // The endpoint returns a bare array (200: Array<…>).
  return {
    data: hasConflict
      ? [
          {
            id: 99,
            reason: 'blocked_time',
            reason_description: 'Blocked',
            start_time: '2024-06-15T09:00:00-04:00',
            end_time: '2024-06-15T10:00:00-04:00',
          },
        ]
      : [],
    response: new Response(null, { status: 200 }),
    request: new Request('https://example.com'),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeAvailableResponse(): any {
  // The endpoint returns a bare array (200: Array<…>).
  return {
    data: [],
    response: new Response(null, { status: 200 }),
    request: new Request('https://example.com'),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeOkResponse(): any {
  return {
    data: {},
    response: new Response(null, { status: 200 }),
    request: new Request('https://example.com'),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return Wrapper;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RescheduleDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('end-after-start validation', () => {
    it('shows error when end time is before start time', async () => {
      // No availability checks should be called; validation fails first.
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeUnavailableResponse(false)
      );
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeAvailableResponse()
      );

      const wrapper = makeQueryWrapper();
      render(
        <RescheduleDialog
          open={true}
          onOpenChange={vi.fn()}
          event={makeEventVM()}
        />,
        { wrapper }
      );

      // Set end time before start time.
      const startInput = screen.getByTestId('reschedule-start-time');
      const endInput = screen.getByTestId('reschedule-end-time');

      await userEvent.clear(startInput);
      await userEvent.type(startInput, '14:00');

      await userEvent.clear(endInput);
      await userEvent.type(endInput, '09:00');

      await userEvent.click(screen.getByTestId('reschedule-submit'));

      await waitFor(() => {
        expect(
          screen.getByText(/end time must be after start time/i)
        ).toBeInTheDocument();
      });

      expect(calendarUnavailableWindowsList).not.toHaveBeenCalled();
    });
  });

  describe('conflict detection', () => {
    it('shows ConflictSurface when the availability check reports a conflict', async () => {
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeUnavailableResponse(true)
      );
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeAvailableResponse()
      );

      const wrapper = makeQueryWrapper();
      render(
        <RescheduleDialog
          open={true}
          onOpenChange={vi.fn()}
          event={makeEventVM()}
        />,
        { wrapper }
      );

      await userEvent.click(screen.getByTestId('reschedule-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('conflict-surface')).toBeInTheDocument();
      });
    });

    it('does NOT show ConflictSurface when there are no conflicts', async () => {
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeUnavailableResponse(false)
      );
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeAvailableResponse()
      );
      vi.mocked(calendarEventsPartialUpdate).mockResolvedValue(
        makeOkResponse()
      );

      const onOpenChange = vi.fn();
      const wrapper = makeQueryWrapper();
      render(
        <RescheduleDialog
          open={true}
          onOpenChange={onOpenChange}
          event={makeEventVM()}
        />,
        { wrapper }
      );

      await userEvent.click(screen.getByTestId('reschedule-submit'));

      await waitFor(() => {
        expect(
          screen.queryByTestId('conflict-surface')
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('conflict override', () => {
    it('calls rescheduleBooking after clicking "Book anyway"', async () => {
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeUnavailableResponse(true)
      );
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeAvailableResponse()
      );
      vi.mocked(calendarEventsPartialUpdate).mockResolvedValue(
        makeOkResponse()
      );

      const wrapper = makeQueryWrapper();
      render(
        <RescheduleDialog
          open={true}
          onOpenChange={vi.fn()}
          event={makeEventVM()}
        />,
        { wrapper }
      );

      // Submit the form to trigger the availability check.
      await userEvent.click(screen.getByTestId('reschedule-submit'));

      // Wait for ConflictSurface to appear.
      await waitFor(() => {
        expect(screen.getByTestId('conflict-surface')).toBeInTheDocument();
      });

      // Click "Book anyway" to override.
      await userEvent.click(screen.getByTestId('book-anyway-btn'));

      await waitFor(() => {
        expect(calendarEventsPartialUpdate).toHaveBeenCalledOnce();
      });
    });

    it('dismisses ConflictSurface when "Adjust time" is clicked', async () => {
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeUnavailableResponse(true)
      );
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeAvailableResponse()
      );

      const wrapper = makeQueryWrapper();
      render(
        <RescheduleDialog
          open={true}
          onOpenChange={vi.fn()}
          event={makeEventVM()}
        />,
        { wrapper }
      );

      await userEvent.click(screen.getByTestId('reschedule-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('conflict-surface')).toBeInTheDocument();
      });

      await userEvent.click(
        screen.getByRole('button', { name: /adjust time/i })
      );

      await waitFor(() => {
        expect(
          screen.queryByTestId('conflict-surface')
        ).not.toBeInTheDocument();
        // Form should be back.
        expect(screen.getByTestId('reschedule-form')).toBeInTheDocument();
      });
    });
  });

  describe('recurring event — scope prompt', () => {
    it('shows ScopePromptDialog after a clean submit on a recurring event', async () => {
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeUnavailableResponse(false)
      );
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeAvailableResponse()
      );

      const wrapper = makeQueryWrapper();
      render(
        <RescheduleDialog
          open={true}
          onOpenChange={vi.fn()}
          event={makeRecurringEventVM()}
        />,
        { wrapper }
      );

      await userEvent.click(screen.getByTestId('reschedule-submit'));

      await waitFor(() => {
        // ScopePromptDialog contains the action label text.
        expect(
          screen.getByText(/reschedule recurring event/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe('non-recurring event — no scope prompt', () => {
    it('does NOT show ScopePromptDialog for a non-recurring event', async () => {
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeUnavailableResponse(false)
      );
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeAvailableResponse()
      );
      vi.mocked(calendarEventsPartialUpdate).mockResolvedValue(
        makeOkResponse()
      );

      const onOpenChange = vi.fn();
      const wrapper = makeQueryWrapper();
      render(
        <RescheduleDialog
          open={true}
          onOpenChange={onOpenChange}
          event={makeEventVM()}
        />,
        { wrapper }
      );

      await userEvent.click(screen.getByTestId('reschedule-submit'));

      await waitFor(() => {
        expect(calendarEventsPartialUpdate).toHaveBeenCalledOnce();
      });

      // ScopePromptDialog should never appear.
      expect(
        screen.queryByText(/reschedule recurring event/i)
      ).not.toBeInTheDocument();
    });
  });

  describe('naive-local write payload / offset check params', () => {
    it('write payload start_time/end_time are naive local (no offset, no Z)', async () => {
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeUnavailableResponse(false)
      );
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeAvailableResponse()
      );
      vi.mocked(calendarEventsPartialUpdate).mockResolvedValue(
        makeOkResponse()
      );

      const wrapper = makeQueryWrapper();
      render(
        <RescheduleDialog
          open={true}
          onOpenChange={vi.fn()}
          event={makeEventVM()}
        />,
        { wrapper }
      );

      await userEvent.click(screen.getByTestId('reschedule-submit'));

      await waitFor(() => {
        expect(calendarEventsPartialUpdate).toHaveBeenCalledOnce();
      });

      const callArg = vi.mocked(calendarEventsPartialUpdate).mock.calls[0][0];
      const startTime = callArg.body?.start_time as string;
      const endTime = callArg.body?.end_time as string;

      // Write payload must be naive local: no UTC offset and no trailing Z
      expect(startTime).toMatch(/T\d{2}:\d{2}:\d{2}$/);
      expect(endTime).toMatch(/T\d{2}:\d{2}:\d{2}$/);
      expect(startTime).not.toMatch(/[+-]\d{2}:\d{2}|Z$/);
      expect(endTime).not.toMatch(/[+-]\d{2}:\d{2}|Z$/);

      // Availability check must still receive the OFFSET form.
      const checkCall = vi.mocked(calendarUnavailableWindowsList).mock
        .calls[0][0];
      const checkStart = checkCall.query?.start_datetime as string;
      expect(checkStart).toMatch(/[+-]\d{2}:\d{2}$/);
    });
  });
});
