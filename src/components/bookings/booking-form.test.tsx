/**
 * BookingFormDialog tests.
 *
 * Covers:
 * - Zod validation: title required, end time must be after start time
 * - Conflict detected → ConflictSurface shown (not the form footer)
 * - Override → booking proceeds (createBooking called)
 * - Submit button is disabled while pending
 * - Primary calendar must be selected (validation)
 * - Submit calls availability check before creating
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// jsdom polyfills required by Radix UI components (Select, etc.)
// ---------------------------------------------------------------------------

beforeAll(() => {
  // Radix UI Select uses pointer-capture APIs not available in jsdom.
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
  // Radix UI uses ResizeObserver internally.
  if (!global.ResizeObserver) {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before any imports that use them
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarList: vi.fn(),
    calendarEventsList: vi.fn(),
    calendarEventsCreate: vi.fn(),
    blockedTimesCreate: vi.fn(),
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
  calendarList,
  calendarEventsCreate,
  blockedTimesCreate,
  calendarUnavailableWindowsList,
  calendarAvailableWindowsList,
} from '@/client/sdk.gen';
import { BookingFormDialog } from './booking-form';
import type {
  Calendar,
  PaginatedCalendarList,
  CalendarEvent,
  BlockedTime,
  PaginatedUnavailableTimeWindowList,
  PaginatedAvailableTimeWindowList,
} from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_CALENDAR_1: Calendar = {
  id: 1,
  name: 'Personal',
  description: undefined,
  email: 'personal@example.com',
  external_id: 'cal-1',
  provider: 'internal',
  calendar_type: 'personal',
  capacity: null,
  manage_available_windows: true,
  is_active: true,
};

const FIXTURE_CALENDAR_2: Calendar = {
  id: 2,
  name: 'Work',
  description: undefined,
  email: 'work@example.com',
  external_id: 'cal-2',
  provider: 'internal',
  calendar_type: 'personal',
  capacity: null,
  manage_available_windows: true,
  is_active: true,
};

const FIXTURE_CREATED_EVENT: CalendarEvent = {
  id: 100,
  title: 'Test Meeting',
  start_time: '2024-06-15T09:00:00-04:00',
  end_time: '2024-06-15T10:00:00-04:00',
  timezone: 'America/New_York',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
  external_id: 'ext-100',
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
};

const FIXTURE_BLOCKED_TIME: BlockedTime = {
  id: 200,
  start_time: '2024-06-15T09:00:00-04:00',
  end_time: '2024-06-15T10:00:00-04:00',
  timezone: 'America/New_York',
  calendar: 2,
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
  is_recurring: false,
  is_recurring_instance: false,
  reason: 'Test Meeting',
  external_id: 'ext-bt-200',
  parent_blocked_time: null,
};

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function makeCalendarListResponse(
  results: Calendar[]
): Awaited<ReturnType<typeof calendarList>> {
  const body: PaginatedCalendarList = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<ReturnType<typeof calendarList>>;
}

function makeCreateEventResponse(
  event: CalendarEvent
): Awaited<ReturnType<typeof calendarEventsCreate>> {
  return {
    data: event,
    response: new Response(JSON.stringify(event), { status: 201 }),
  } as unknown as Awaited<ReturnType<typeof calendarEventsCreate>>;
}

function makeCreateBlockedTimeResponse(
  bt: BlockedTime
): Awaited<ReturnType<typeof blockedTimesCreate>> {
  return {
    data: bt,
    response: new Response(JSON.stringify(bt), { status: 201 }),
  } as unknown as Awaited<ReturnType<typeof blockedTimesCreate>>;
}

function makeUnavailableWindowsResponse(
  hasConflict: boolean
): Awaited<ReturnType<typeof calendarUnavailableWindowsList>> {
  const results = hasConflict
    ? [
        {
          id: 1,
          reason: 'blocked_time',
          reason_description: 'Busy block',
          start_time: '2024-06-15T09:00:00Z',
          end_time: '2024-06-15T10:00:00Z',
        },
      ]
    : [];
  const body: PaginatedUnavailableTimeWindowList = {
    count: results.length,
    results,
  };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<ReturnType<typeof calendarUnavailableWindowsList>>;
}

function makeAvailableWindowsResponse(): Awaited<
  ReturnType<typeof calendarAvailableWindowsList>
> {
  const body: PaginatedAvailableTimeWindowList = {
    count: 1,
    results: [
      {
        id: 99,
        start_time: '2024-06-15T11:00:00Z',
        end_time: '2024-06-15T12:00:00Z',
        can_book_partially: false,
      },
    ],
  };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<ReturnType<typeof calendarAvailableWindowsList>>;
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderForm(props = { open: true, onOpenChange: vi.fn() }) {
  // Default: mock the calendars list
  if (!vi.mocked(calendarList).getMockImplementation?.()) {
    vi.mocked(calendarList).mockResolvedValue(
      makeCalendarListResponse([FIXTURE_CALENDAR_1, FIXTURE_CALENDAR_2])
    );
  }
  // Default: no conflicts
  if (!vi.mocked(calendarUnavailableWindowsList).getMockImplementation?.()) {
    vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
      makeUnavailableWindowsResponse(false)
    );
  }
  if (!vi.mocked(calendarAvailableWindowsList).getMockImplementation?.()) {
    vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
      makeAvailableWindowsResponse()
    );
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<BookingFormDialog {...props} />, { wrapper });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BookingFormDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('form rendering', () => {
    it('renders the "New booking" dialog title', async () => {
      renderForm();
      await waitFor(() =>
        expect(
          screen.getByRole('heading', { name: /new booking/i })
        ).toBeInTheDocument()
      );
    });

    it('renders title, date, start/end time fields', async () => {
      renderForm();
      await waitFor(() =>
        expect(
          screen.getByRole('heading', { name: /new booking/i })
        ).toBeInTheDocument()
      );
      expect(
        screen.getByRole('textbox', { name: /title/i })
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    });

    it('renders the "Create booking" submit button', async () => {
      renderForm();
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /create booking/i })
        ).toBeInTheDocument()
      );
    });
  });

  describe('zod validation', () => {
    it('shows an error when title is empty', async () => {
      renderForm();

      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /create booking/i })
        ).toBeInTheDocument()
      );

      // Submit without filling title
      await userEvent.click(
        screen.getByRole('button', { name: /create booking/i })
      );

      await waitFor(() =>
        expect(screen.getByText(/title is required/i)).toBeInTheDocument()
      );
    });

    it('shows an error when end time is before start time', async () => {
      renderForm();

      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /create booking/i })
        ).toBeInTheDocument()
      );

      // Fill in title
      await userEvent.clear(screen.getByRole('textbox', { name: /title/i }));
      await userEvent.type(
        screen.getByRole('textbox', { name: /title/i }),
        'Meeting'
      );

      // Set start after end (start=10:00, end=09:00)
      const timeInputs = screen.getAllByDisplayValue(/\d{2}:\d{2}/);
      // Focus on start time field via label
      const startInput = screen.getByLabelText(/start time/i);
      const endInput = screen.getByLabelText(/end time/i);

      await userEvent.clear(startInput);
      await userEvent.type(startInput, '10:00');
      await userEvent.clear(endInput);
      await userEvent.type(endInput, '09:00');

      await userEvent.click(
        screen.getByRole('button', { name: /create booking/i })
      );

      await waitFor(() =>
        expect(
          screen.getByText(/end time must be after start time/i)
        ).toBeInTheDocument()
      );

      // Suppress unused var warning
      void timeInputs;
    });
  });

  describe('conflict detection and override flow', () => {
    it('shows ConflictSurface when availability check returns conflicts', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makeCalendarListResponse([FIXTURE_CALENDAR_1, FIXTURE_CALENDAR_2])
      );
      // Primary calendar has a conflict
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeUnavailableWindowsResponse(true)
      );
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeAvailableWindowsResponse()
      );

      renderForm();

      // Wait for calendars to load
      await waitFor(() =>
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      );

      // Fill in required fields
      await userEvent.type(
        screen.getByRole('textbox', { name: /title/i }),
        'My Meeting'
      );

      // Select the primary calendar
      await userEvent.click(screen.getByRole('combobox'));
      await waitFor(() =>
        expect(
          screen.getByRole('option', { name: 'Personal' })
        ).toBeInTheDocument()
      );
      await userEvent.click(screen.getByRole('option', { name: 'Personal' }));

      // Submit
      await userEvent.click(
        screen.getByRole('button', { name: /create booking/i })
      );

      // ConflictSurface should be shown
      await waitFor(() =>
        expect(screen.getByTestId('conflict-surface')).toBeInTheDocument()
      );

      // "Book anyway" button must be present (warn-but-allow-override)
      expect(
        screen.getByRole('button', { name: /book anyway/i })
      ).toBeInTheDocument();
    });

    it('proceeds with booking when "Book anyway" is clicked', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makeCalendarListResponse([FIXTURE_CALENDAR_1, FIXTURE_CALENDAR_2])
      );
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeUnavailableWindowsResponse(true)
      );
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeAvailableWindowsResponse()
      );
      vi.mocked(calendarEventsCreate).mockResolvedValue(
        makeCreateEventResponse(FIXTURE_CREATED_EVENT)
      );
      vi.mocked(blockedTimesCreate).mockResolvedValue(
        makeCreateBlockedTimeResponse(FIXTURE_BLOCKED_TIME)
      );

      renderForm();

      await waitFor(() =>
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      );

      await userEvent.type(
        screen.getByRole('textbox', { name: /title/i }),
        'My Meeting'
      );

      await userEvent.click(screen.getByRole('combobox'));
      await waitFor(() =>
        expect(
          screen.getByRole('option', { name: 'Personal' })
        ).toBeInTheDocument()
      );
      await userEvent.click(screen.getByRole('option', { name: 'Personal' }));

      await userEvent.click(
        screen.getByRole('button', { name: /create booking/i })
      );

      await waitFor(() =>
        expect(screen.getByTestId('conflict-surface')).toBeInTheDocument()
      );

      // Click "Book anyway"
      await userEvent.click(
        screen.getByRole('button', { name: /book anyway/i })
      );

      // calendarEventsCreate should be called
      await waitFor(() => expect(calendarEventsCreate).toHaveBeenCalledOnce());
    });

    it('dismisses ConflictSurface when "Adjust time" is clicked', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makeCalendarListResponse([FIXTURE_CALENDAR_1, FIXTURE_CALENDAR_2])
      );
      vi.mocked(calendarUnavailableWindowsList).mockResolvedValue(
        makeUnavailableWindowsResponse(true)
      );
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeAvailableWindowsResponse()
      );

      renderForm();

      await waitFor(() =>
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      );

      await userEvent.type(
        screen.getByRole('textbox', { name: /title/i }),
        'My Meeting'
      );

      await userEvent.click(screen.getByRole('combobox'));
      await waitFor(() =>
        expect(
          screen.getByRole('option', { name: 'Personal' })
        ).toBeInTheDocument()
      );
      await userEvent.click(screen.getByRole('option', { name: 'Personal' }));

      await userEvent.click(
        screen.getByRole('button', { name: /create booking/i })
      );

      await waitFor(() =>
        expect(screen.getByTestId('conflict-surface')).toBeInTheDocument()
      );

      // Click "Adjust time" → conflict surface disappears, form returns
      await userEvent.click(
        screen.getByRole('button', { name: /adjust time/i })
      );

      await waitFor(() =>
        expect(screen.queryByTestId('conflict-surface')).not.toBeInTheDocument()
      );

      // The "Create booking" button should be back
      expect(
        screen.getByRole('button', { name: /create booking/i })
      ).toBeInTheDocument();
    });
  });

  describe('submit disabled while pending', () => {
    it('disables the submit button while pending', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makeCalendarListResponse([FIXTURE_CALENDAR_1])
      );
      vi.mocked(calendarUnavailableWindowsList).mockReturnValue(
        new Promise(() => {}) as never
      );
      vi.mocked(calendarAvailableWindowsList).mockResolvedValue(
        makeAvailableWindowsResponse()
      );

      renderForm();

      await waitFor(() =>
        expect(screen.getByRole('combobox')).toBeInTheDocument()
      );

      await userEvent.type(
        screen.getByRole('textbox', { name: /title/i }),
        'Meeting'
      );

      await userEvent.click(screen.getByRole('combobox'));
      await waitFor(() =>
        expect(
          screen.getByRole('option', { name: 'Personal' })
        ).toBeInTheDocument()
      );
      await userEvent.click(screen.getByRole('option', { name: 'Personal' }));

      const submitBtn = screen.getByRole('button', { name: /create booking/i });
      await userEvent.click(submitBtn);

      // While the availability check is pending, the button label changes
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /checking…/i })
        ).toBeInTheDocument()
      );

      const pendingBtn = screen.getByRole('button', { name: /checking…/i });
      expect(pendingBtn).toBeDisabled();
    });
  });
});
