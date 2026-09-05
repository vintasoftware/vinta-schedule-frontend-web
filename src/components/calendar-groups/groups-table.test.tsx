import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type {
  Calendar,
  CalendarGroup,
  PaginatedCalendarGroupList,
  PaginatedCalendarList,
} from '@/client';
import { GroupsTable, COLUMNS, createColumns } from './groups-table';
import { PermissionProvider } from '@/components/navigation/permission-gate';
import { OWNED_CALENDARS_PAGE_SIZE } from '@/hooks/calendars/use-owned-calendar-ids';

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
    calendarList: vi.fn(),
  };
});

// After mocks are hoisted, import the SDK
import { calendarGroupsList, calendarList } from '@/client/sdk.gen';

// The full admin capability set — a member who can manage members reads as
// "admin" for this table's org-wide list behaviour.
const ADMIN_PERMISSIONS = [
  'organizations.manage_members',
  'organizations.manage_organization',
  'organizations.manage_branding',
  'payments.manage_billing',
];

// Maps the old role labels the tests read in terms of onto the permission
// arrays the provider now takes. 'admin' → the full admin set, 'member' → an
// empty set, null → the not-yet-resolved state.
function permissionsForRole(
  role: 'admin' | 'member' | null
): readonly string[] | null {
  if (role === null) return null;
  return role === 'admin' ? ADMIN_PERMISSIONS : [];
}

// Helper to render the table with proper setup. Role defaults to 'admin' to
// preserve the org-wide list behaviour existing tests exercise; pass
// role={null} to exercise the not-yet-resolved state, or 'member' for the
// scoped list.
function renderGroupsTable(role: 'admin' | 'member' | null = 'admin') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <PermissionProvider permissions={permissionsForRole(role)}>
        {children}
      </PermissionProvider>
    </QueryClientProvider>
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

function makeCalendarListResponse(
  results: PaginatedCalendarList['results']
): Awaited<ReturnType<typeof calendarList>> {
  const body: PaginatedCalendarList = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<ReturnType<typeof calendarList>>;
}

function ownedCalendar(id: number): Calendar {
  return {
    id,
    name: `Owned calendar ${id}`,
    email: `owned-${id}@example.com`,
    external_id: `ext-${id}`,
    provider: 'google',
    calendar_type: 'personal',
  };
}

function makePool(id: number, name: string) {
  return {
    id,
    name,
    description: '',
    calendars: [],
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  };
}

// `count` groups; the group at `ownedGroupIndex` contains a slot with the
// calendar the member owns (id 999) — every other group is empty (owned by
// no one in these tests).
function makeManyGroups(
  count: number,
  ownedGroupIndex: number
): CalendarGroup[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Group ${i + 1}`,
    description: '',
    slots: [
      {
        id: i + 1,
        name: 'Slot 1',
        required_count: 1,
        calendars: i === ownedGroupIndex ? [ownedCalendar(999)] : [],
        pools: [],
      },
    ],
    public_booking_slug: `group-${i + 1}`,
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  }));
}

describe('GroupsTable', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    vi.clearAllMocks();
    // Default: no owned calendars, so the member/unresolved-role branch
    // renders an empty (not hanging) list unless a test overrides this.
    vi.mocked(calendarList).mockResolvedValue(makeCalendarListResponse([]));
  });

  const mockGroups: CalendarGroup[] = [
    {
      id: 1,
      name: 'Frontend Team',
      description: 'For frontend team meetings',
      slots: [
        { id: 1, name: 'Slot 1', required_count: 1, calendars: [], pools: [] },
      ],
      public_booking_slug: 'frontend-team',
      created: '2024-01-01T00:00:00Z',
      modified: '2024-01-01T00:00:00Z',
    },
    {
      id: 2,
      name: 'Backend Team',
      description: 'For backend team syncs',
      slots: [
        { id: 2, name: 'Slot 1', required_count: 2, calendars: [], pools: [] },
        { id: 3, name: 'Slot 2', required_count: 1, calendars: [], pools: [] },
      ],
      public_booking_slug: 'backend-team',
      created: '2024-01-01T00:00:00Z',
      modified: '2024-01-01T00:00:00Z',
    },
  ];

  it('renders rows from a mocked calendarGroupsList (admin)', async () => {
    vi.mocked(calendarGroupsList).mockResolvedValueOnce(
      makePagedResponse(mockGroups, 2)
    );

    renderGroupsTable('admin');

    // Wait for the table to render
    const nameCell = await screen.findByText('Frontend Team');
    expect(nameCell).toBeInTheDocument();

    // Check that the second group is also rendered
    const secondNameCell = screen.getByText('Backend Team');
    expect(secondNameCell).toBeInTheDocument();
  });

  it('shows empty state when no groups found (admin)', async () => {
    vi.mocked(calendarGroupsList).mockResolvedValueOnce(
      makePagedResponse([], 0)
    );

    renderGroupsTable('admin');

    const emptyText = await screen.findByText('No calendar groups found.');
    expect(emptyText).toBeInTheDocument();
  });

  it('exports COLUMNS with name, description, slots, and pools columns', () => {
    expect(COLUMNS).toHaveLength(4);
    expect(COLUMNS[0]?.id).toBe('name');
    expect(COLUMNS[1]?.id).toBe('description');
    expect(COLUMNS[2]?.id).toBe('slots');
    expect(COLUMNS[3]?.id).toBe('pools');
  });

  it('createColumns appends a single actions column to the shared set', () => {
    const columns = createColumns([], new Set<number>(), vi.fn(), vi.fn());
    expect(columns).toHaveLength(COLUMNS.length + 1);
    expect(columns[columns.length - 1]?.id).toBe('actions');
  });

  it('an admin gets a per-row Edit action; a member gets none', async () => {
    vi.mocked(calendarGroupsList).mockResolvedValue(
      makePagedResponse(mockGroups, 2)
    );

    const { unmount } = renderGroupsTable('admin');
    expect(
      await screen.findByRole('button', { name: /edit group frontend team/i })
    ).toBeInTheDocument();
    unmount();

    // The member branch filters to groups holding a calendar they own; give it
    // one so a row actually renders and the absence of the action is meaningful.
    vi.mocked(calendarList).mockResolvedValue(
      makeCalendarListResponse([ownedCalendar(999)])
    );
    vi.mocked(calendarGroupsList).mockResolvedValue(
      makePagedResponse(makeManyGroups(1, 0), 1)
    );

    renderGroupsTable('member');

    await screen.findByRole('link', { name: 'Group 1' });
    expect(
      screen.queryByRole('button', { name: /edit group/i })
    ).not.toBeInTheDocument();
  });

  it('names each attached pool once in the Pools column, even across slots', async () => {
    const pooledGroup: CalendarGroup = {
      id: 9,
      name: 'Clinic',
      description: '',
      public_booking_slug: 'grp-9',
      slots: [
        {
          id: 1,
          name: 'Nurse',
          required_count: 1,
          calendars: [],
          pools: [makePool(7, 'Nurses')],
        },
        {
          id: 2,
          name: 'Second nurse',
          required_count: 1,
          calendars: [],
          // Same pool on a second slot — the column must not repeat it.
          pools: [makePool(7, 'Nurses'), makePool(8, 'Rooms')],
        },
      ],
      created: '2024-01-01T00:00:00Z',
      modified: '2024-01-01T00:00:00Z',
    };

    vi.mocked(calendarGroupsList).mockResolvedValueOnce(
      makePagedResponse([pooledGroup], 1)
    );

    renderGroupsTable('admin');

    expect(await screen.findAllByText('Nurses')).toHaveLength(1);
    expect(screen.getByText('Rooms')).toBeInTheDocument();
  });

  it('links the name cell to the group detail route', async () => {
    vi.mocked(calendarGroupsList).mockResolvedValueOnce(
      makePagedResponse(mockGroups, 2)
    );

    renderGroupsTable('admin');

    const link = await screen.findByRole('link', { name: 'Frontend Team' });
    expect(link).toHaveAttribute('href', '/groups/1');

    const secondLink = screen.getByRole('link', { name: 'Backend Team' });
    expect(secondLink).toHaveAttribute('href', '/groups/2');
  });

  // -------------------------------------------------------------------
  // BLOCKER 1 — role === null must fail CLOSED (member-scoped), never
  // fall open into admin chrome.
  // -------------------------------------------------------------------

  it('role === null (not yet resolved) renders member-scoped output: no create affordance, and fetches with a member-shaped large single page, never the admin URL-driven page', async () => {
    vi.mocked(calendarGroupsList).mockResolvedValue(makePagedResponse([], 0));

    renderGroupsTable(null);

    await waitFor(() => expect(calendarGroupsList).toHaveBeenCalled());

    expect(screen.queryByTestId('new-group-button')).not.toBeInTheDocument();

    const call = vi.mocked(calendarGroupsList).mock.calls[0]?.[0] as
      | { query?: { limit?: number; offset?: number } }
      | undefined;
    // The admin-shaped query would use the URL-driven page size (20, from
    // DEFAULT_DATA_TABLE_QUERY) at offset 0. A member-shaped fetch instead
    // uses the large single-page limit that mirrors useOwnedCalendarIds.
    expect(call?.query?.limit).toBe(OWNED_CALENDARS_PAGE_SIZE);
    expect(call?.query?.offset).toBe(0);
  });

  it('hides the create action and dialog for a member', async () => {
    vi.mocked(calendarGroupsList).mockResolvedValue(makePagedResponse([], 0));

    renderGroupsTable('member');

    await screen.findByText('No calendar groups found.');
    expect(screen.queryByTestId('new-group-button')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------
  // BLOCKER 2 — a member's owned group must be reachable even when it
  // falls outside the org's first server-paginated page.
  // -------------------------------------------------------------------

  it("a member whose owned group falls outside the org's first server page can still find it", async () => {
    // 25 org groups (server default page size is 20); the member's owned
    // group is #25 — on server page 2, unreachable if the ownership filter
    // ran on a single server-paginated page.
    const allGroups = makeManyGroups(25, 24);
    vi.mocked(calendarGroupsList).mockImplementation((async (options?: {
      query?: { limit?: number; offset?: number };
    }) => {
      const limit = options?.query?.limit ?? allGroups.length;
      const offset = options?.query?.offset ?? 0;
      return makePagedResponse(
        allGroups.slice(offset, offset + limit),
        allGroups.length
      );
    }) as typeof calendarGroupsList);
    vi.mocked(calendarList).mockResolvedValue(
      makeCalendarListResponse([ownedCalendar(999)])
    );

    renderGroupsTable('member');

    expect(await screen.findByText('Group 25')).toBeInTheDocument();
    expect(
      screen.queryByText('No calendar groups found.')
    ).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1–1 of 1')).toBeInTheDocument();
  });

  describe('get scheduling link action', () => {
    it('shows the action for a member who owns a calendar in the group roster', async () => {
      const group = makeManyGroups(1, 0)[0]!;
      vi.mocked(calendarGroupsList).mockResolvedValueOnce(
        makePagedResponse([group], 1)
      );
      vi.mocked(calendarList).mockResolvedValue(
        makeCalendarListResponse([ownedCalendar(999)])
      );

      renderGroupsTable('member');

      expect(
        await screen.findByRole('button', {
          name: `Get scheduling link for ${group.name}`,
        })
      ).toBeInTheDocument();
    });

    it('shows the action for an admin even for a group with an empty roster', async () => {
      vi.mocked(calendarGroupsList).mockResolvedValueOnce(
        makePagedResponse(mockGroups, 2)
      );

      renderGroupsTable('admin');

      expect(
        await screen.findByRole('button', {
          name: 'Get scheduling link for Frontend Team',
        })
      ).toBeInTheDocument();
    });

    // The denied case cannot be produced by rendering <GroupsTable> itself:
    // for a member, `groupHasOwnedCalendar` (the pre-existing Phase 2 filter)
    // removes exactly the rows a member would be denied for before this
    // column ever runs, and `permissions === null` holds the whole table in
    // its loading branch. So this exercises the "actions" column's cell
    // renderer directly, the way `createColumns` is exported for.
    it('actions cell renders nothing for a viewer canMintBookingLinkForGroup denies (only reachable by testing the column directly)', () => {
      const group = makeManyGroups(1, 0)[0]!;
      const columns = createColumns([], new Set<number>(), vi.fn(), vi.fn());
      const actionsColumn = columns.find((column) => column.id === 'actions');
      const cell = actionsColumn?.cell as (props: {
        row: { original: CalendarGroup };
      }) => ReactNode;

      const { container } = render(<>{cell({ row: { original: group } })}</>);

      expect(container).toBeEmptyDOMElement();
    });
  });
});
