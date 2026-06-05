/**
 * EventsView tests.
 *
 * Covers:
 * - Events render chronologically in agenda view
 * - Chronological order is a real sort, not passthrough (reverse-input case)
 * - Two events in different timezones each show their own timezone label
 *   within their own event container (not just anywhere in the DOM)
 * - Empty state renders (CalendarView "No events in this range." message)
 * - Loading state renders the loading indicator
 * - Error state renders the error message
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Browser API stubs required by react-big-calendar in jsdom
// ---------------------------------------------------------------------------

beforeAll(() => {
  if (!global.ResizeObserver) {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before imports that depend on them
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/events',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarEventsList: vi.fn(),
  };
});

import { calendarEventsList } from '@/client/sdk.gen';
import { EventsView } from './events-view';
import type { CalendarEvent, PaginatedCalendarEventList } from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STUB_PARENT_EVENT = {
  id: 0,
  title: '',
  external_id: '',
  start_time: '2024-01-01T00:00:00Z',
  end_time: '2024-01-01T00:00:00Z',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
} as const;

/**
 * Event 1: starts 2024-06-15 at 09:00 in America/New_York (EDT, UTC-4).
 * Earlier start time = should appear FIRST in chronological order.
 */
const FIXTURE_EARLY_NY: CalendarEvent = {
  id: 1,
  title: 'Early NY Meeting',
  start_time: '2024-06-15T09:00:00-04:00',
  end_time: '2024-06-15T10:00:00-04:00',
  timezone: 'America/New_York',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
  external_id: 'ext-1',
  external_attendances: [],
  attendances: [],
  resource_allocations: [],
  parent_recurring_object: STUB_PARENT_EVENT,
  is_recurring: false,
  is_recurring_instance: false,
};

/**
 * Event 2: starts 2024-06-16 at 09:00 in Australia/Sydney (AEST, UTC+10).
 * UTC instant = 2024-06-15T23:00Z — later than FIXTURE_EARLY_NY (13:00Z).
 */
const FIXTURE_LATER_SYD: CalendarEvent = {
  id: 2,
  title: 'Sydney Afternoon',
  start_time: '2024-06-16T09:00:00+10:00',
  end_time: '2024-06-16T09:30:00+10:00',
  timezone: 'Australia/Sydney',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
  external_id: 'ext-2',
  external_attendances: [],
  attendances: [],
  resource_allocations: [],
  parent_recurring_object: STUB_PARENT_EVENT,
  is_recurring: false,
  is_recurring_instance: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePagedResponse(
  results: CalendarEvent[],
  count = results.length
): Awaited<ReturnType<typeof calendarEventsList>> {
  const body: PaginatedCalendarEventList = { count, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof calendarEventsList>>;
}

/**
 * Render EventsView with a fixed initialDate anchored to 2024-06-15 so the
 * fixture events (June 15–16, 2024) fall within the 7-day visible window.
 */
const FIXTURE_ANCHOR = new Date('2024-06-15T00:00:00Z');

function renderEventsView(props?: { calendarId?: number; initialDate?: Date }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<EventsView initialDate={FIXTURE_ANCHOR} {...props} />, {
    wrapper,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EventsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('populated state', () => {
    it('renders event titles from the API response', async () => {
      vi.mocked(calendarEventsList).mockResolvedValue(
        makePagedResponse([FIXTURE_EARLY_NY, FIXTURE_LATER_SYD])
      );

      renderEventsView();

      await waitFor(() => {
        expect(screen.getAllByText('Early NY Meeting').length).toBeGreaterThan(
          0
        );
      });
      expect(screen.getAllByText('Sydney Afternoon').length).toBeGreaterThan(0);
    });

    it('renders events chronologically — earlier start appears before later start in document order', async () => {
      // Return NY first, Sydney second — this is the happy path.
      vi.mocked(calendarEventsList).mockResolvedValue(
        makePagedResponse([FIXTURE_EARLY_NY, FIXTURE_LATER_SYD])
      );

      renderEventsView();

      await waitFor(() => {
        expect(screen.getAllByText('Early NY Meeting').length).toBeGreaterThan(
          0
        );
      });

      const nyEl = screen.getAllByText('Early NY Meeting')[0];
      const sydEl = screen.getAllByText('Sydney Afternoon')[0];
      // compareDocumentPosition FOLLOWING = 4 — NY must come before Syd
      expect(
        nyEl.compareDocumentPosition(sydEl) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it('renders events chronologically even when API returns later event first', async () => {
      // Return Sydney (later UTC start) BEFORE New York (earlier UTC start).
      // RBC's agenda view must still display NY before Syd.
      vi.mocked(calendarEventsList).mockResolvedValue(
        makePagedResponse([FIXTURE_LATER_SYD, FIXTURE_EARLY_NY])
      );

      renderEventsView();

      await waitFor(() => {
        expect(screen.getAllByText('Early NY Meeting').length).toBeGreaterThan(
          0
        );
      });

      const nyEl = screen.getAllByText('Early NY Meeting')[0];
      const sydEl = screen.getAllByText('Sydney Afternoon')[0];
      // NY event (2024-06-15T13:00Z) must appear before Syd (2024-06-15T23:00Z)
      expect(
        nyEl.compareDocumentPosition(sydEl) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    });

    it('renders each event with its own timezone label within its own container', async () => {
      vi.mocked(calendarEventsList).mockResolvedValue(
        makePagedResponse([FIXTURE_EARLY_NY, FIXTURE_LATER_SYD])
      );

      renderEventsView();

      await waitFor(() => {
        expect(screen.getAllByText('Early NY Meeting').length).toBeGreaterThan(
          0
        );
      });

      // The DefaultEventContent renderer outputs:
      //   <span class="flex min-w-0 flex-col leading-tight">       ← outer (flex container)
      //     <span class="truncate font-medium">{title}</span>      ← [0] title span
      //     <span class="... text-xs">{timezoneLabel}</span>       ← [1] label span
      //   </span>
      //
      // We locate the parent flex-container span via the title element, then
      // read its second child span (the timezone label).  This assertion would
      // fail if labels were swapped between event containers.

      const nyTitleEl = screen.getAllByText('Early NY Meeting')[0];
      // parentElement = the flex-col outer span
      const nyLabelEl = nyTitleEl.parentElement?.children[1] ?? null;
      expect(nyLabelEl).not.toBeNull();
      expect(nyLabelEl?.textContent).toContain('UTC-4');

      const sydTitleEl = screen.getAllByText('Sydney Afternoon')[0];
      const sydLabelEl = sydTitleEl.parentElement?.children[1] ?? null;
      expect(sydLabelEl).not.toBeNull();
      expect(sydLabelEl?.textContent).toContain('UTC+10');
    });
  });

  describe('empty state', () => {
    it('shows the RBC empty message when there are no events', async () => {
      vi.mocked(calendarEventsList).mockResolvedValue(makePagedResponse([]));

      renderEventsView();

      // CalendarView sets messages.noEventsInRange = 'No events in this range.'
      await waitFor(() => {
        expect(
          screen.getByText('No events in this range.')
        ).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('shows a loading indicator while the query is in flight', () => {
      vi.mocked(calendarEventsList).mockReturnValue(
        new Promise(() => {}) as never
      );

      renderEventsView();

      // The loading state renders before the query resolves
      expect(screen.getByText('Loading events…')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows an error message when the API call fails', async () => {
      vi.mocked(calendarEventsList).mockRejectedValue(
        new Error('Network error')
      );

      renderEventsView();

      await waitFor(() => {
        expect(screen.getByText(/Failed to load events/i)).toBeInTheDocument();
      });
    });

    it('includes the error message text', async () => {
      vi.mocked(calendarEventsList).mockRejectedValue(
        new Error('Connection refused')
      );

      renderEventsView();

      await waitFor(() => {
        expect(screen.getByText(/Connection refused/i)).toBeInTheDocument();
      });
    });
  });
});
