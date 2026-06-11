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
  usePathname: () => '/all-calendars',
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
    calendarAdminSyncCreate: vi.fn(),
  };
});

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// After mocks are hoisted, import the modules under test.
import { calendarList, calendarAdminSyncCreate } from '@/client/sdk.gen';
import { toast } from 'sonner';
import userEvent from '@testing-library/user-event';
import { AllCalendarsTable } from './all-calendars-table';

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

function renderAllCalendarsTable() {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<AllCalendarsTable />, { wrapper });
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

const ALL_CALENDARS_FIXTURE: PaginatedCalendarList['results'] = [
  {
    id: 1,
    name: 'User A Personal',
    description: 'Personal calendar',
    email: 'usera@example.com',
    external_id: 'ext1',
    provider: 'google',
    calendar_type: 'personal',
    capacity: null,
    visibility: 'active',
  },
  {
    id: 2,
    name: 'Conference Room A',
    description: 'Resource calendar',
    email: 'rooma@example.com',
    external_id: 'ext2',
    provider: 'microsoft',
    calendar_type: 'resource',
    capacity: 20,
    visibility: 'active',
  },
  {
    id: 3,
    name: 'Virtual Room',
    description: 'Virtual calendar',
    email: 'virtual@example.com',
    external_id: 'ext3',
    provider: 'internal',
    calendar_type: 'virtual',
    capacity: null,
    visibility: 'active',
  },
  {
    id: 4,
    name: 'Bundle Calendar',
    description: 'Bundle calendar',
    email: 'bundle@example.com',
    external_id: 'ext4',
    provider: 'internal',
    calendar_type: 'bundle',
    capacity: null,
    visibility: 'active',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AllCalendarsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('populated state', () => {
    it('renders all calendar rows from the API response', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(ALL_CALENDARS_FIXTURE)
      );

      renderAllCalendarsTable();

      // Wait for data to load (skeleton → rows).
      await waitFor(() => {
        expect(screen.getByText('User A Personal')).toBeInTheDocument();
      });

      expect(screen.getByText('Conference Room A')).toBeInTheDocument();
      expect(screen.getByText('Virtual Room')).toBeInTheDocument();
      expect(screen.getByText('Bundle Calendar')).toBeInTheDocument();
    });

    it('renders all 4 calendar type badges distinctly', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(ALL_CALENDARS_FIXTURE)
      );

      renderAllCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('User A Personal')).toBeInTheDocument();
      });

      // Check for all calendar type badges
      expect(screen.getByText('personal')).toBeInTheDocument();
      expect(screen.getByText('resource')).toBeInTheDocument();
      expect(screen.getByText('virtual')).toBeInTheDocument();
      expect(screen.getByText('bundle')).toBeInTheDocument();
    });

    it('renders provider badges', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(ALL_CALENDARS_FIXTURE)
      );

      renderAllCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('User A Personal')).toBeInTheDocument();
      });

      // Check for provider badges
      expect(screen.getByText('google')).toBeInTheDocument();
      expect(screen.getByText('microsoft')).toBeInTheDocument();
      const internalBadges = screen.getAllByText('internal');
      expect(internalBadges.length).toBe(2); // Virtual + Bundle
    });

    it('renders status badges', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(ALL_CALENDARS_FIXTURE)
      );

      renderAllCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('User A Personal')).toBeInTheDocument();
      });

      // All calendars in the fixture are active
      const activeBadges = screen.getAllByText('active');
      expect(activeBadges.length).toBe(4);
    });
  });

  describe('empty state', () => {
    it('shows the empty state message when there are no calendars', async () => {
      vi.mocked(calendarList).mockResolvedValue(makePagedResponse([]));

      renderAllCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('No calendars found.')).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('renders skeleton rows while data is fetching', async () => {
      // Never resolve — stays in loading state.
      vi.mocked(calendarList).mockReturnValue(new Promise(() => {}) as never);

      renderAllCalendarsTable();

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

      renderAllCalendarsTable();

      await waitFor(() => {
        expect(
          screen.getByText('Failed to load calendars.')
        ).toBeInTheDocument();
      });
    });
  });

  describe('pagination', () => {
    it('shows pagination controls when there are multiple pages', async () => {
      // 100 total with default pageSize 20 → 5 pages → Next button visible.
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(ALL_CALENDARS_FIXTURE, 100)
      );

      renderAllCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('User A Personal')).toBeInTheDocument();
      });

      expect(screen.getByLabelText(/go to next page/i)).toBeInTheDocument();
    });

    it('page 2 query maps to offset = pageSize and limit = pageSize', async () => {
      const PAGE_SIZE = 20;
      const page2Response = makePagedResponse(ALL_CALENDARS_FIXTURE, 100);
      vi.mocked(calendarList).mockResolvedValue(page2Response);

      // Import and call useAllCalendars via a test component that accepts a query prop.
      const { useAllCalendars } =
        await import('@/hooks/calendars/use-all-calendars');
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
      const { result } = renderHook(() => useAllCalendars(page2Query), {
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

  describe('sync calendar action', () => {
    it('renders a sync button for each calendar row', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(ALL_CALENDARS_FIXTURE)
      );

      renderAllCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('User A Personal')).toBeInTheDocument();
      });

      // Should have 4 sync buttons (one per calendar).
      const syncButtons = screen.getAllByText('Sync');
      expect(syncButtons.length).toBe(4);
    });

    it('calls calendarAdminSyncCreate when sync button is clicked', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(ALL_CALENDARS_FIXTURE)
      );
      vi.mocked(calendarAdminSyncCreate).mockResolvedValue({
        data: { status: 'success' },
        response: new Response(JSON.stringify({ status: 'success' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        }),
      } as unknown as Awaited<ReturnType<typeof calendarAdminSyncCreate>>);

      const user = userEvent.setup();
      renderAllCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('User A Personal')).toBeInTheDocument();
      });

      // Click the first sync button.
      const syncButtons = screen.getAllByRole('button', { name: /sync/i });
      await user.click(syncButtons[0]);

      // calendarAdminSyncCreate should have been called with the calendar id.
      await waitFor(() => {
        expect(vi.mocked(calendarAdminSyncCreate)).toHaveBeenCalled();
      });

      const calls = vi.mocked(calendarAdminSyncCreate).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]?.path?.id).toBe('1');

      // Success toast should be shown.
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Sync started',
        expect.objectContaining({
          description: expect.stringContaining('User A Personal'),
        })
      );
    });

    it('shows error toast when sync fails', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(ALL_CALENDARS_FIXTURE)
      );
      vi.mocked(calendarAdminSyncCreate).mockRejectedValue(
        new Error('Sync failed')
      );

      const user = userEvent.setup();
      renderAllCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('User A Personal')).toBeInTheDocument();
      });

      // Click the first sync button.
      const syncButtons = screen.getAllByRole('button', { name: /sync/i });
      await user.click(syncButtons[0]);

      // Error toast should be shown.
      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          'Failed to start sync',
          expect.objectContaining({
            description: 'Sync failed',
          })
        );
      });
    });

    it('disables sync button while mutation is in progress', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(ALL_CALENDARS_FIXTURE)
      );
      // Simulate a pending mutation.
      vi.mocked(calendarAdminSyncCreate).mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          }) as never
      );

      const user = userEvent.setup();
      renderAllCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('User A Personal')).toBeInTheDocument();
      });

      // Click the first sync button.
      const syncButtons = screen.getAllByRole('button', { name: /sync/i });
      await user.click(syncButtons[0]);

      // The button should show "Syncing..." (the loading state).
      await waitFor(() => {
        const syncingButton = screen.getByText('Syncing…');
        expect(syncingButton).toBeInTheDocument();
      });
    });

    it('debounces double-click (only one request sent)', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(ALL_CALENDARS_FIXTURE)
      );
      vi.mocked(calendarAdminSyncCreate).mockResolvedValue({
        data: { status: 'success' },
        response: new Response(JSON.stringify({ status: 'success' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        }),
      } as unknown as Awaited<ReturnType<typeof calendarAdminSyncCreate>>);

      const user = userEvent.setup();
      renderAllCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('User A Personal')).toBeInTheDocument();
      });

      // Get the sync button and double-click it quickly.
      const syncButtons = screen.getAllByRole('button', { name: /sync/i });
      const firstButton = syncButtons[0];

      // First click
      await user.click(firstButton);

      // Second click (should be debounced/disabled because the first is in flight)
      await user.click(firstButton);

      // Wait for mutation to complete.
      await waitFor(() => {
        expect(vi.mocked(calendarAdminSyncCreate)).toHaveBeenCalled();
      });

      // Only one request should have been made (not two).
      const calls = vi.mocked(calendarAdminSyncCreate).mock.calls;
      expect(calls.length).toBe(1);
    });
  });
});
