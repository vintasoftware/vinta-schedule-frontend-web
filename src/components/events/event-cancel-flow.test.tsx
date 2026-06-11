/**
 * EventAttendeesSheet — cancel booking flow tests.
 *
 * Covers:
 *  - Non-recurring event: shows "Cancel event" button; clicking it opens an
 *    AlertDialog confirm; confirming calls calendarEventsDestroy.
 *  - Non-recurring event: clicking "Keep event" in the confirm dialog does NOT
 *    call destroy (cancel = no-op).
 *  - Recurring event: clicking "Cancel event" opens the ScopePromptDialog
 *    (NOT the AlertDialog).
 *  - Recurring event: selecting a scope and confirming calls the appropriate op.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { DateTime } from 'luxon';

// ---------------------------------------------------------------------------
// Browser API stubs for Radix
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
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/events',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarEventsDestroy: vi.fn(),
    calendarEventsCreateExceptionCreate: vi.fn(),
    calendarEventsBulkModifyCreate: vi.fn(),
    calendarEventsPartialUpdate: vi.fn(),
    calendarList: vi.fn(),
  };
});

import {
  calendarEventsDestroy,
  calendarEventsCreateExceptionCreate,
  calendarEventsBulkModifyCreate,
  calendarEventsPartialUpdate,
  calendarList,
} from '@/client/sdk.gen';
import { toast } from 'sonner';
import { EventAttendeesSheet } from './event-attendees-editor';
import type { CalendarEventVM } from '@/components/calendar/event-vm';
import type { CalendarEvent, Calendar, PaginatedCalendarList } from '@/client';

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

function makeVoidResponse() {
  return {
    data: undefined,
    response: new Response(null, { status: 204 }),
  } as unknown as Awaited<ReturnType<typeof calendarEventsDestroy>>;
}

function makeCalendarsResponse(): Awaited<ReturnType<typeof calendarList>> {
  const data: PaginatedCalendarList = { count: 0, results: [] };
  return {
    data,
    response: new Response(JSON.stringify(data), { status: 200 }),
  } as unknown as Awaited<ReturnType<typeof calendarList>>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWrapper() {
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

function renderSheet(event: CalendarEventVM, onOpenChange = vi.fn()) {
  return render(
    <EventAttendeesSheet open event={event} onOpenChange={onOpenChange} />,
    { wrapper: makeWrapper() }
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EventAttendeesSheet — cancel flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(calendarList).mockResolvedValue(makeCalendarsResponse());
    vi.mocked(calendarEventsPartialUpdate).mockResolvedValue(
      makeVoidResponse() as never
    );
  });

  describe('non-recurring event', () => {
    it('shows "Cancel event" button', () => {
      renderSheet(makeEventVM());
      expect(
        screen.getByRole('button', { name: 'Cancel event' })
      ).toBeInTheDocument();
    });

    it('opens the AlertDialog when "Cancel event" is clicked', async () => {
      renderSheet(makeEventVM());

      await userEvent.click(
        screen.getByRole('button', { name: 'Cancel event' })
      );

      // AlertDialog should be open — it contains a "Keep event" cancel button
      expect(
        screen.getByRole('button', { name: 'Keep event' })
      ).toBeInTheDocument();
    });

    it('calls calendarEventsDestroy after confirm in AlertDialog', async () => {
      vi.mocked(calendarEventsDestroy).mockResolvedValue(makeVoidResponse());

      renderSheet(makeEventVM());

      await userEvent.click(
        screen.getByRole('button', { name: 'Cancel event' })
      );
      // Click the action button in the AlertDialog (last button matching "Cancel event")
      const cancelBtns = screen.getAllByRole('button', {
        name: 'Cancel event',
      });
      // The last one is the AlertDialog confirm button
      await userEvent.click(cancelBtns[cancelBtns.length - 1]);

      await waitFor(() => {
        expect(calendarEventsDestroy).toHaveBeenCalledOnce();
        expect(calendarEventsDestroy).toHaveBeenCalledWith({
          path: { id: '42' },
        });
      });
    });

    it('does NOT call destroy when "Keep event" is clicked (cancel = no-op)', async () => {
      renderSheet(makeEventVM());

      await userEvent.click(
        screen.getByRole('button', { name: 'Cancel event' })
      );
      await userEvent.click(screen.getByRole('button', { name: 'Keep event' }));

      expect(calendarEventsDestroy).not.toHaveBeenCalled();
    });

    it('shows a success toast after successful cancel', async () => {
      vi.mocked(calendarEventsDestroy).mockResolvedValue(makeVoidResponse());

      renderSheet(makeEventVM());

      await userEvent.click(
        screen.getByRole('button', { name: 'Cancel event' })
      );
      const cancelBtns = screen.getAllByRole('button', {
        name: 'Cancel event',
      });
      await userEvent.click(cancelBtns[cancelBtns.length - 1]);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Event cancelled',
          expect.anything()
        );
      });
    });
  });

  describe('recurring event', () => {
    it('opens the ScopePromptDialog (not AlertDialog) when "Cancel event" is clicked', async () => {
      renderSheet(makeRecurringEventVM());

      await userEvent.click(
        screen.getByRole('button', { name: 'Cancel event' })
      );

      // ScopePromptDialog renders scope options
      expect(screen.getByText('This event')).toBeInTheDocument();
      expect(screen.getByText('This and following events')).toBeInTheDocument();
      expect(screen.getByText('All events')).toBeInTheDocument();
      // AlertDialog's "Keep event" should NOT be present
      expect(
        screen.queryByRole('button', { name: 'Keep event' })
      ).not.toBeInTheDocument();
    });

    it('calls calendarEventsCreateExceptionCreate for scope "this"', async () => {
      vi.mocked(calendarEventsCreateExceptionCreate).mockResolvedValue(
        makeVoidResponse()
      );

      renderSheet(makeRecurringEventVM());

      await userEvent.click(
        screen.getByRole('button', { name: 'Cancel event' })
      );

      // "This event" is selected by default; click the action button in the scope dialog
      const cancelBtns = screen.getAllByRole('button', { name: 'Cancel' });
      await userEvent.click(cancelBtns[cancelBtns.length - 1]);

      await waitFor(() => {
        expect(calendarEventsCreateExceptionCreate).toHaveBeenCalledOnce();
      });
    });

    it('calls calendarEventsBulkModifyCreate for scope "following"', async () => {
      vi.mocked(calendarEventsBulkModifyCreate).mockResolvedValue(
        makeVoidResponse()
      );

      renderSheet(makeRecurringEventVM());

      await userEvent.click(
        screen.getByRole('button', { name: 'Cancel event' })
      );
      await userEvent.click(
        screen.getByRole('radio', { name: /this and following events/i })
      );
      const cancelBtns = screen.getAllByRole('button', { name: 'Cancel' });
      await userEvent.click(cancelBtns[cancelBtns.length - 1]);

      await waitFor(() => {
        expect(calendarEventsBulkModifyCreate).toHaveBeenCalledOnce();
      });
    });
  });
});
