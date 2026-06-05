/**
 * EditEventDialog tests.
 *
 * Covers:
 *  - End-after-start validation: shows error when end <= start.
 *  - Title required validation.
 *  - Recurring event → ScopePromptDialog appears after form submit.
 *  - Recurring event, scope = "This event" → calendarEventsCreateExceptionCreate.
 *  - Non-recurring event → NO ScopePromptDialog; calendarEventsPartialUpdate called directly.
 *  - Success toast on successful edit.
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
  calendarEventsCreateExceptionCreate,
} from '@/client/sdk.gen';
import { toast } from 'sonner';
import { EditEventDialog } from './edit-event-dialog';
import type { CalendarEventVM } from '@/components/calendar/event-vm';
import type { CalendarEvent } from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRaw(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 42,
    title: 'Team Meeting',
    description: 'Weekly sync',
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

describe('EditEventDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validation', () => {
    it('shows error when end time is before start time', async () => {
      const wrapper = makeQueryWrapper();
      render(
        <EditEventDialog
          open={true}
          onOpenChange={vi.fn()}
          event={makeEventVM()}
        />,
        { wrapper }
      );

      // Set end time before start time.
      const startInput = screen.getByTestId('edit-event-start-time');
      const endInput = screen.getByTestId('edit-event-end-time');

      await userEvent.clear(startInput);
      await userEvent.type(startInput, '14:00');

      await userEvent.clear(endInput);
      await userEvent.type(endInput, '09:00');

      await userEvent.click(screen.getByTestId('edit-event-submit'));

      await waitFor(() => {
        expect(
          screen.getByText(/end time must be after start time/i)
        ).toBeInTheDocument();
      });

      expect(calendarEventsPartialUpdate).not.toHaveBeenCalled();
    });

    it('shows error when title is empty', async () => {
      const wrapper = makeQueryWrapper();
      render(
        <EditEventDialog
          open={true}
          onOpenChange={vi.fn()}
          event={makeEventVM()}
        />,
        { wrapper }
      );

      const titleInput = screen.getByTestId('edit-event-title');
      await userEvent.clear(titleInput);

      await userEvent.click(screen.getByTestId('edit-event-submit'));

      await waitFor(() => {
        expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      });

      expect(calendarEventsPartialUpdate).not.toHaveBeenCalled();
    });
  });

  describe('non-recurring event', () => {
    it('calls calendarEventsPartialUpdate directly (no scope prompt)', async () => {
      vi.mocked(calendarEventsPartialUpdate).mockResolvedValue(
        makeOkResponse()
      );

      const onOpenChange = vi.fn();
      const wrapper = makeQueryWrapper();
      render(
        <EditEventDialog
          open={true}
          onOpenChange={onOpenChange}
          event={makeEventVM()}
        />,
        { wrapper }
      );

      await userEvent.click(screen.getByTestId('edit-event-submit'));

      await waitFor(() => {
        expect(calendarEventsPartialUpdate).toHaveBeenCalledOnce();
      });

      // ScopePromptDialog should NOT appear.
      expect(
        screen.queryByText(/edit recurring event/i)
      ).not.toBeInTheDocument();
    });

    it('does NOT show ScopePromptDialog for non-recurring event', async () => {
      vi.mocked(calendarEventsPartialUpdate).mockResolvedValue(
        makeOkResponse()
      );

      const wrapper = makeQueryWrapper();
      render(
        <EditEventDialog
          open={true}
          onOpenChange={vi.fn()}
          event={makeEventVM()}
        />,
        { wrapper }
      );

      await userEvent.click(screen.getByTestId('edit-event-submit'));

      await waitFor(() => {
        expect(calendarEventsPartialUpdate).toHaveBeenCalled();
      });

      // No scope options visible.
      expect(
        screen.queryByText('This and following events')
      ).not.toBeInTheDocument();
    });

    it('shows a success toast on successful edit', async () => {
      vi.mocked(calendarEventsPartialUpdate).mockResolvedValue(
        makeOkResponse()
      );

      const wrapper = makeQueryWrapper();
      render(
        <EditEventDialog
          open={true}
          onOpenChange={vi.fn()}
          event={makeEventVM()}
        />,
        { wrapper }
      );

      await userEvent.click(screen.getByTestId('edit-event-submit'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Event updated',
          expect.anything()
        );
      });
    });
  });

  describe('recurring event — scope prompt', () => {
    it('shows ScopePromptDialog after submit on a recurring event', async () => {
      const wrapper = makeQueryWrapper();
      render(
        <EditEventDialog
          open={true}
          onOpenChange={vi.fn()}
          event={makeRecurringEventVM()}
        />,
        { wrapper }
      );

      await userEvent.click(screen.getByTestId('edit-event-submit'));

      await waitFor(() => {
        // ScopePromptDialog uses the actionLabel in the dialog title.
        expect(screen.getByText(/edit recurring event/i)).toBeInTheDocument();
      });
    });

    it('shows all three scope options in the prompt', async () => {
      const wrapper = makeQueryWrapper();
      render(
        <EditEventDialog
          open={true}
          onOpenChange={vi.fn()}
          event={makeRecurringEventVM()}
        />,
        { wrapper }
      );

      await userEvent.click(screen.getByTestId('edit-event-submit'));

      await waitFor(() => {
        expect(screen.getByText('This event')).toBeInTheDocument();
        expect(
          screen.getByText('This and following events')
        ).toBeInTheDocument();
        expect(screen.getByText('All events')).toBeInTheDocument();
      });
    });

    it('"This event" scope → calls calendarEventsCreateExceptionCreate', async () => {
      vi.mocked(calendarEventsCreateExceptionCreate).mockResolvedValue(
        makeOkResponse()
      );

      const wrapper = makeQueryWrapper();
      render(
        <EditEventDialog
          open={true}
          onOpenChange={vi.fn()}
          event={makeRecurringEventVM()}
        />,
        { wrapper }
      );

      // Submit the form to open the scope prompt.
      await userEvent.click(screen.getByTestId('edit-event-submit'));

      await waitFor(() => {
        expect(screen.getByText(/edit recurring event/i)).toBeInTheDocument();
      });

      // "This event" is selected by default; click the action button (last "Edit" button).
      const editBtns = screen.getAllByRole('button', { name: 'Edit' });
      await userEvent.click(editBtns[editBtns.length - 1]);

      await waitFor(() => {
        expect(calendarEventsCreateExceptionCreate).toHaveBeenCalledOnce();
      });

      const call = vi.mocked(calendarEventsCreateExceptionCreate).mock
        .calls[0][0];
      expect(call.body.exception_date).toBe('2024-06-15');
      expect(call.body.is_cancelled).toBeFalsy();
    });

    it('"This event" scope → does NOT call partialUpdate', async () => {
      vi.mocked(calendarEventsCreateExceptionCreate).mockResolvedValue(
        makeOkResponse()
      );

      const wrapper = makeQueryWrapper();
      render(
        <EditEventDialog
          open={true}
          onOpenChange={vi.fn()}
          event={makeRecurringEventVM()}
        />,
        { wrapper }
      );

      await userEvent.click(screen.getByTestId('edit-event-submit'));

      await waitFor(() => {
        expect(screen.getByText(/edit recurring event/i)).toBeInTheDocument();
      });

      const editBtns = screen.getAllByRole('button', { name: 'Edit' });
      await userEvent.click(editBtns[editBtns.length - 1]);

      await waitFor(() => {
        expect(calendarEventsCreateExceptionCreate).toHaveBeenCalledOnce();
      });

      expect(calendarEventsPartialUpdate).not.toHaveBeenCalled();
    });
  });
});
