import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { PaginatedCalendarGroupList } from '@/client';
import { GroupsTable, COLUMNS } from './groups-table';
import type { CalendarGroup } from '@/client';

// Mutable URL state — shared across all mock calls in a single test.
let mockSearchParams = new URLSearchParams();

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/groups',
  useSearchParams: () => mockSearchParams,
}));

// Mock the SDK
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarGroupsList: vi.fn(),
  };
});

// After mocks are hoisted, import the SDK
import { calendarGroupsList } from '@/client/sdk.gen';

// Helper to render the table with proper setup
function renderGroupsTable() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<GroupsTable />, { wrapper });
}

// Helper to make a properly typed paginated response
function makePagedResponse(
  results: PaginatedCalendarGroupList['results'],
  count = results.length
) {
  const body: PaginatedCalendarGroupList = {
    count,
    results,
  };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof calendarGroupsList>>;
}

describe('GroupsTable', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
  });

  const mockGroups: CalendarGroup[] = [
    {
      id: 1,
      name: 'Frontend Team',
      description: 'For frontend team meetings',
      slots: [{ id: 1, name: 'Slot 1', required_count: 1, calendars: [] }],
      created: '2024-01-01T00:00:00Z',
      modified: '2024-01-01T00:00:00Z',
    },
    {
      id: 2,
      name: 'Backend Team',
      description: 'For backend team syncs',
      slots: [
        { id: 2, name: 'Slot 1', required_count: 2, calendars: [] },
        { id: 3, name: 'Slot 2', required_count: 1, calendars: [] },
      ],
      created: '2024-01-01T00:00:00Z',
      modified: '2024-01-01T00:00:00Z',
    },
  ];

  it('renders rows from a mocked calendarGroupsList', async () => {
    vi.mocked(calendarGroupsList).mockResolvedValueOnce(
      makePagedResponse(mockGroups, 2)
    );

    renderGroupsTable();

    // Wait for the table to render
    const nameCell = await screen.findByText('Frontend Team');
    expect(nameCell).toBeInTheDocument();

    // Check that the second group is also rendered
    const secondNameCell = screen.getByText('Backend Team');
    expect(secondNameCell).toBeInTheDocument();
  });

  it('shows empty state when no groups found', async () => {
    vi.mocked(calendarGroupsList).mockResolvedValueOnce(
      makePagedResponse([], 0)
    );

    renderGroupsTable();

    const emptyText = await screen.findByText('No calendar groups found.');
    expect(emptyText).toBeInTheDocument();
  });

  it('exports COLUMNS with name, description, and slots columns', () => {
    expect(COLUMNS).toHaveLength(3);
    expect(COLUMNS[0]?.id).toBe('name');
    expect(COLUMNS[1]?.id).toBe('description');
    expect(COLUMNS[2]?.id).toBe('slots');
  });
});
