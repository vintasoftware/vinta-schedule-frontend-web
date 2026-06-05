import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { PaginatedCalendarList } from '@/client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock navigation — DataTableQueryBoundary → useDataTableQuery → useSearchParams
const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  usePathname: () => '/calendars',
  useSearchParams: () => new URLSearchParams(),
}));

// The generated calendarListOptions (in @/client/@tanstack/react-query.gen)
// internally calls calendarList from @/client/sdk.gen.
// We mock at the sdk.gen boundary so both the TanStack options factory AND any
// direct callers are intercepted.
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarList: vi.fn(),
  };
});

// After mocks are hoisted, import the modules under test.
import { calendarList } from '@/client/sdk.gen';
import { CalendarsTable } from './calendars-table';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderCalendarsTable() {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<CalendarsTable />, { wrapper });
}

function makePagedResponse(
  results: PaginatedCalendarList['results'],
  count = results.length
) {
  const body: PaginatedCalendarList = {
    count,
    results,
  };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof calendarList>>;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CALENDARS_FIXTURE: PaginatedCalendarList['results'] = [
  {
    id: 1,
    name: 'Personal Calendar',
    description: 'My personal calendar',
    email: 'user@example.com',
    external_id: 'ext1',
    provider: 'google',
    calendar_type: 'personal',
    capacity: null,
    is_active: true,
  },
  {
    id: 2,
    name: 'Team Resources',
    description: 'Shared resources',
    email: 'resources@example.com',
    external_id: 'ext2',
    provider: 'microsoft',
    calendar_type: 'resource',
    capacity: 10,
    is_active: true,
  },
  {
    id: 3,
    name: 'Virtual Meetings',
    description: 'Online meetings',
    email: 'virtual@example.com',
    external_id: 'ext3',
    provider: 'internal',
    calendar_type: 'virtual',
    capacity: null,
    is_active: false,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CalendarsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('populated state', () => {
    it('renders calendar rows from the API response', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );

      renderCalendarsTable();

      // Wait for data to load (skeleton → rows).
      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      expect(screen.getByText('Team Resources')).toBeInTheDocument();
      expect(screen.getByText('Virtual Meetings')).toBeInTheDocument();
    });

    it('renders calendar type badges', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );

      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      // Check for calendar type badges
      expect(screen.getByText('personal')).toBeInTheDocument();
      expect(screen.getByText('resource')).toBeInTheDocument();
      expect(screen.getByText('virtual')).toBeInTheDocument();
    });

    it('renders provider badges', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );

      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      // Check for provider badges
      expect(screen.getByText('google')).toBeInTheDocument();
      expect(screen.getByText('microsoft')).toBeInTheDocument();
      expect(screen.getByText('internal')).toBeInTheDocument();
    });

    it('renders status badges: active and disabled', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );

      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      // Check for status badges
      const activeBadges = screen.getAllByText('active');
      expect(activeBadges.length).toBe(2); // Personal + Team Resources

      expect(screen.getByText('disabled')).toBeInTheDocument(); // Virtual Meetings
    });
  });

  describe('empty state', () => {
    it('shows the empty state message when there are no calendars', async () => {
      vi.mocked(calendarList).mockResolvedValue(makePagedResponse([]));

      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('No calendars found.')).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('renders skeleton rows while data is fetching', async () => {
      // Never resolve — stays in loading state.
      vi.mocked(calendarList).mockReturnValue(new Promise(() => {}) as never);

      renderCalendarsTable();

      // The skeleton rows have aria-hidden="true" on the <tr> element.
      await waitFor(() => {
        const skeletonRows = document.querySelectorAll(
          'tr[aria-hidden="true"]'
        );
        expect(skeletonRows.length).toBeGreaterThan(0);
      });
    });
  });

  describe('error state', () => {
    it('shows an error message when the API call fails', async () => {
      vi.mocked(calendarList).mockRejectedValue(new Error('Network error'));

      renderCalendarsTable();

      await waitFor(() => {
        expect(
          screen.getByText('Failed to load calendars.')
        ).toBeInTheDocument();
      });
    });
  });

  describe('pagination', () => {
    it('shows pagination controls when there are multiple pages', async () => {
      // 50 total with default pageSize 20 → 3 pages → Next button visible.
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE, 50)
      );

      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/go to next page/i)).toBeInTheDocument();
    });

    it('page 2 query maps to offset = pageSize and limit = pageSize', async () => {
      const PAGE_SIZE = 20;
      const page2Response = makePagedResponse(CALENDARS_FIXTURE, 50);
      vi.mocked(calendarList).mockResolvedValue(page2Response);

      // Import and call useMyCalendars via a test component that accepts a query prop.
      const { useMyCalendars } =
        await import('@/hooks/calendars/use-my-calendars');
      const { renderHook } = await import('@testing-library/react');
      const { QueryClient, QueryClientProvider } =
        await import('@tanstack/react-query');
      const { createElement } = await import('react');

      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        createElement(QueryClientProvider, { client: qc }, children);

      const page2Query = {
        page: 2,
        pageSize: PAGE_SIZE,
        ordering: null,
        search: null,
      };
      const { result } = renderHook(() => useMyCalendars(page2Query), {
        wrapper,
      });

      // Wait for the query to resolve.
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // calendarList should have been called with the right offset/limit.
      const calls = vi.mocked(calendarList).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const lastCall = calls[calls.length - 1];
      const queryArgs = lastCall[0]?.query as {
        limit?: number;
        offset?: number;
      };
      expect(queryArgs?.limit).toBe(PAGE_SIZE);
      expect(queryArgs?.offset).toBe(PAGE_SIZE); // page 2: offset = (2-1) * pageSize = 20
    });
  });
});
