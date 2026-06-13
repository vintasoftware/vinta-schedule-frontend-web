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
    calendarDestroy: vi.fn(),
    calendarRequestSyncCreate: vi.fn(),
    calendarPartialUpdate: vi.fn(),
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
import {
  calendarList,
  calendarDestroy,
  calendarRequestSyncCreate,
  calendarPartialUpdate,
} from '@/client/sdk.gen';
import { toast } from 'sonner';
import userEvent from '@testing-library/user-event';
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
    visibility: 'active',
    sync_enabled: true,
    manage_available_windows: true,
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
    visibility: 'active',
    sync_enabled: true,
    manage_available_windows: false,
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
    visibility: 'inactive',
    sync_enabled: false,
    manage_available_windows: false,
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

    it('renders status badges: active and inactive', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );

      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      // Check for status badges — the badge shows the visibility value verbatim.
      const activeBadges = screen.getAllByText('active');
      expect(activeBadges.length).toBe(2); // Personal + Team Resources

      expect(screen.getByText('inactive')).toBeInTheDocument(); // Virtual Meetings
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

  describe('delete calendar action', () => {
    it('renders a delete button for each calendar row', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );

      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      // Should have 3 delete buttons (one per calendar).
      const deleteButtons = screen.getAllByText('Delete');
      expect(deleteButtons.length).toBe(3);
    });

    it('opens a confirm dialog when delete button is clicked', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );

      const user = userEvent.setup();
      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      // Click the first delete button.
      const deleteButtons = screen.getAllByText('Delete');
      await user.click(deleteButtons[0]);

      // The confirm dialog should open.
      await waitFor(() => {
        expect(screen.getByText('Delete calendar')).toBeInTheDocument();
        expect(
          screen.getByText(/Are you sure you want to delete/i)
        ).toBeInTheDocument();
      });
    });

    it('calls calendarDestroy when confirm is clicked', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );
      vi.mocked(calendarDestroy).mockResolvedValue({
        data: undefined,
        response: new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      } as unknown as Awaited<ReturnType<typeof calendarDestroy>>);

      const user = userEvent.setup();
      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      // Click the first delete button (table row).
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      // Wait for the alert dialog to appear.
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Find and click the delete confirm button (inside the dialog).
      const confirmButton = screen
        .getAllByRole('button', { name: /delete/i })
        .find(
          (btn) =>
            btn.closest('[role="alertdialog"]') !== null &&
            btn.getAttribute('aria-label') === null
        );
      expect(confirmButton).toBeDefined();
      await user.click(confirmButton!);

      // calendarDestroy should have been called with the calendar id.
      await waitFor(() => {
        expect(vi.mocked(calendarDestroy)).toHaveBeenCalled();
      });

      const calls = vi.mocked(calendarDestroy).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]?.path?.id).toBe('1');

      // Success toast should be shown.
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Calendar deleted',
        expect.objectContaining({
          description: expect.stringContaining('Personal Calendar'),
        })
      );
    });

    it('does not call calendarDestroy when cancel is clicked', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );

      const user = userEvent.setup();
      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      // Click the first delete button.
      const deleteButtons = screen.getAllByText('Delete');
      await user.click(deleteButtons[0]);

      // Click cancel.
      await waitFor(() => {
        expect(screen.getByText('Delete calendar')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      // calendarDestroy should NOT have been called.
      expect(vi.mocked(calendarDestroy)).not.toHaveBeenCalled();
    });

    it('shows error toast when delete fails', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );
      vi.mocked(calendarDestroy).mockRejectedValue(new Error('Delete failed'));

      const user = userEvent.setup();
      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      // Click the first delete button.
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      // Wait for the alert dialog to appear.
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Find and click the delete confirm button (inside the dialog).
      const confirmButton = screen
        .getAllByRole('button', { name: /delete/i })
        .find(
          (btn) =>
            btn.closest('[role="alertdialog"]') !== null &&
            btn.getAttribute('aria-label') === null
        );
      expect(confirmButton).toBeDefined();
      await user.click(confirmButton!);

      // Error toast should be shown.
      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          'Failed to delete calendar',
          expect.objectContaining({
            description: 'Delete failed',
          })
        );
      });
    });

    it('disables delete button while mutation is in progress', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );
      // Simulate a pending mutation.
      vi.mocked(calendarDestroy).mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          }) as never
      );

      const user = userEvent.setup();
      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      // Click the first delete button.
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      // Wait for the alert dialog to appear.
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      // Find and click the delete confirm button (inside the dialog).
      const confirmButton = screen
        .getAllByRole('button', { name: /delete/i })
        .find(
          (btn) =>
            btn.closest('[role="alertdialog"]') !== null &&
            btn.getAttribute('aria-label') === null
        );
      expect(confirmButton).toBeDefined();
      await user.click(confirmButton!);

      // The button should show "Deleting..." (the loading state).
      await waitFor(() => {
        const deletingButton = screen.getByText('Deleting…');
        expect(deletingButton).toBeInTheDocument();
      });
    });
  });

  describe('sync calendar action', () => {
    it('renders a sync button for each calendar row', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );

      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      // Should have 3 sync buttons (one per calendar).
      const syncButtons = screen.getAllByText('Sync');
      expect(syncButtons.length).toBe(3);
    });

    it('calls calendarRequestSyncCreate when sync button is clicked', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );
      vi.mocked(calendarRequestSyncCreate).mockResolvedValue({
        data: { status: 'success' },
        response: new Response(JSON.stringify({ status: 'success' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        }),
      } as unknown as Awaited<ReturnType<typeof calendarRequestSyncCreate>>);

      const user = userEvent.setup();
      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      // Click the first sync button.
      const syncButtons = screen.getAllByRole('button', { name: /sync/i });
      await user.click(syncButtons[0]);

      // calendarRequestSyncCreate should have been called with the calendar id.
      await waitFor(() => {
        expect(vi.mocked(calendarRequestSyncCreate)).toHaveBeenCalled();
      });

      const calls = vi.mocked(calendarRequestSyncCreate).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]?.path?.id).toBe('1');
      // Body should contain start_datetime, end_datetime, and should_update_events.
      expect(lastCall[0]?.body).toMatchObject({
        should_update_events: true,
      });
      expect(lastCall[0]?.body?.start_datetime).toBeTruthy();
      expect(lastCall[0]?.body?.end_datetime).toBeTruthy();

      // Success toast should be shown.
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Sync started',
        expect.objectContaining({
          description: expect.stringContaining('Personal Calendar'),
        })
      );
    });

    it('shows error toast when sync fails', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );
      vi.mocked(calendarRequestSyncCreate).mockRejectedValue(
        new Error('Sync failed')
      );

      const user = userEvent.setup();
      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
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
        makePagedResponse(CALENDARS_FIXTURE)
      );
      // Simulate a pending mutation.
      vi.mocked(calendarRequestSyncCreate).mockImplementation(
        () =>
          new Promise(() => {
            /* never resolves */
          }) as never
      );

      const user = userEvent.setup();
      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
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
        makePagedResponse(CALENDARS_FIXTURE)
      );
      vi.mocked(calendarRequestSyncCreate).mockResolvedValue({
        data: { status: 'success' },
        response: new Response(JSON.stringify({ status: 'success' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        }),
      } as unknown as Awaited<ReturnType<typeof calendarRequestSyncCreate>>);

      const user = userEvent.setup();
      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
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
        expect(vi.mocked(calendarRequestSyncCreate)).toHaveBeenCalled();
      });

      // Only one request should have been made (not two).
      const calls = vi.mocked(calendarRequestSyncCreate).mock.calls;
      expect(calls.length).toBe(1);
    });
  });

  describe('auto-sync toggle', () => {
    it('renders an auto-sync switch per row reflecting sync_enabled', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );

      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      // One switch per calendar; aria-label flips on current state.
      const enableSwitch = screen.getByRole('switch', {
        name: /enable sync for virtual meetings/i,
      });
      const disableSwitch = screen.getByRole('switch', {
        name: /disable sync for personal calendar/i,
      });
      expect(enableSwitch).toHaveAttribute('aria-checked', 'false');
      expect(disableSwitch).toHaveAttribute('aria-checked', 'true');
    });

    it('PATCHes sync_enabled=false when an enabled calendar is toggled off', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );
      vi.mocked(calendarPartialUpdate).mockResolvedValue({
        data: { ...CALENDARS_FIXTURE[0], sync_enabled: false },
        response: new Response(null, { status: 200 }),
      } as unknown as Awaited<ReturnType<typeof calendarPartialUpdate>>);

      const user = userEvent.setup();
      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole('switch', {
          name: /disable sync for personal calendar/i,
        })
      );

      await waitFor(() => {
        expect(vi.mocked(calendarPartialUpdate)).toHaveBeenCalled();
      });

      const calls = vi.mocked(calendarPartialUpdate).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]?.path?.id).toBe('1');
      expect(lastCall[0]?.body).toEqual({ sync_enabled: false });

      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Sync disabled',
        expect.objectContaining({
          description: expect.stringContaining('Personal Calendar'),
        })
      );
    });

    it('PATCHes sync_enabled=true when a disabled calendar is toggled on', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );
      vi.mocked(calendarPartialUpdate).mockResolvedValue({
        data: { ...CALENDARS_FIXTURE[2], sync_enabled: true },
        response: new Response(null, { status: 200 }),
      } as unknown as Awaited<ReturnType<typeof calendarPartialUpdate>>);

      const user = userEvent.setup();
      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Virtual Meetings')).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole('switch', {
          name: /enable sync for virtual meetings/i,
        })
      );

      await waitFor(() => {
        expect(vi.mocked(calendarPartialUpdate)).toHaveBeenCalled();
      });

      const calls = vi.mocked(calendarPartialUpdate).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]?.path?.id).toBe('3');
      expect(lastCall[0]?.body).toEqual({ sync_enabled: true });
    });

    it('shows an error toast when the toggle fails', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );
      vi.mocked(calendarPartialUpdate).mockRejectedValue(
        new Error('Update failed')
      );

      const user = userEvent.setup();
      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole('switch', {
          name: /disable sync for personal calendar/i,
        })
      );

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          'Failed to update sync',
          expect.objectContaining({ description: 'Update failed' })
        );
      });
    });
  });

  describe('manage-available-windows toggle', () => {
    it('renders a manage-windows switch per row reflecting manage_available_windows', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );

      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Personal Calendar')).toBeInTheDocument();
      });

      const enabled = screen.getByRole('switch', {
        name: /disable managing available windows for personal calendar/i,
      });
      const disabled = screen.getByRole('switch', {
        name: /enable managing available windows for team resources/i,
      });
      expect(enabled).toHaveAttribute('aria-checked', 'true');
      expect(disabled).toHaveAttribute('aria-checked', 'false');
    });

    it('PATCHes manage_available_windows=true when toggled on', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );
      vi.mocked(calendarPartialUpdate).mockResolvedValue({
        data: { ...CALENDARS_FIXTURE[1], manage_available_windows: true },
        response: new Response(null, { status: 200 }),
      } as unknown as Awaited<ReturnType<typeof calendarPartialUpdate>>);

      const user = userEvent.setup();
      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Team Resources')).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole('switch', {
          name: /enable managing available windows for team resources/i,
        })
      );

      await waitFor(() => {
        expect(vi.mocked(calendarPartialUpdate)).toHaveBeenCalled();
      });

      const calls = vi.mocked(calendarPartialUpdate).mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]?.path?.id).toBe('2');
      expect(lastCall[0]?.body).toEqual({ manage_available_windows: true });

      expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
        'Managing own windows',
        expect.objectContaining({
          description: expect.stringContaining('Team Resources'),
        })
      );
    });

    it('shows an error toast when the toggle fails', async () => {
      vi.mocked(calendarList).mockResolvedValue(
        makePagedResponse(CALENDARS_FIXTURE)
      );
      vi.mocked(calendarPartialUpdate).mockRejectedValue(
        new Error('Update failed')
      );

      const user = userEvent.setup();
      renderCalendarsTable();

      await waitFor(() => {
        expect(screen.getByText('Team Resources')).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole('switch', {
          name: /enable managing available windows for team resources/i,
        })
      );

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          'Failed to update availability windows',
          expect.objectContaining({ description: 'Update failed' })
        );
      });
    });
  });
});
