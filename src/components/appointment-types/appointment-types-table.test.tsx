import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type {
  Calendar,
  AppointmentType,
  PaginatedAppointmentTypeList,
  PaginatedCalendarList,
} from '@/client';
import {
  AppointmentTypesTable,
  COLUMNS,
  createColumns,
} from './appointment-types-table';
import { PermissionProvider } from '@/components/navigation/permission-gate';
import { OWNED_CALENDARS_PAGE_SIZE } from '@/hooks/calendars/use-owned-calendar-ids';

// Mutable URL state — shared across all mock calls in a single test.
let mockSearchParams = new URLSearchParams();

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/appointment-types',
  useSearchParams: () => mockSearchParams,
}));

// Mock the SDK
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    appointmentTypesList: vi.fn(),
    calendarList: vi.fn(),
  };
});

// After mocks are hoisted, import the SDK
import { appointmentTypesList, calendarList } from '@/client/sdk.gen';

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
function renderAppointmentTypesTable(
  role: 'admin' | 'member' | null = 'admin'
) {
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
  return render(<AppointmentTypesTable />, { wrapper });
}

// Helper to make a properly typed paginated response
function makePagedResponse(
  results: PaginatedAppointmentTypeList['results'],
  count = results.length
) {
  const body: PaginatedAppointmentTypeList = {
    count,
    results,
  };
  return {
    data: body,
    response: new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof appointmentTypesList>>;
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

// `count` appointment types; the appointment type at `ownedAppointmentTypeIndex` contains a slot with the
// calendar the member owns (id 999) — every other appointment type is empty (owned by
// no one in these tests).
function makeManyAppointmentTypes(
  count: number,
  ownedAppointmentTypeIndex: number
): AppointmentType[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Appointment Type ${i + 1}`,
    description: '',
    slots: [
      {
        id: i + 1,
        name: 'Slot 1',
        required_count: 1,
        calendars: i === ownedAppointmentTypeIndex ? [ownedCalendar(999)] : [],
        pools: [],
      },
    ],
    public_booking_slug: `appointment type-${i + 1}`,
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  }));
}

describe('AppointmentTypesTable', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    vi.clearAllMocks();
    // Default: no owned calendars, so the member/unresolved-role branch
    // renders an empty (not hanging) list unless a test overrides this.
    vi.mocked(calendarList).mockResolvedValue(makeCalendarListResponse([]));
  });

  const mockAppointmentTypes: AppointmentType[] = [
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

  it('renders rows from a mocked appointmentTypesList (admin)', async () => {
    vi.mocked(appointmentTypesList).mockResolvedValueOnce(
      makePagedResponse(mockAppointmentTypes, 2)
    );

    renderAppointmentTypesTable('admin');

    // Wait for the table to render
    const nameCell = await screen.findByText('Frontend Team');
    expect(nameCell).toBeInTheDocument();

    // Check that the second appointment type is also rendered
    const secondNameCell = screen.getByText('Backend Team');
    expect(secondNameCell).toBeInTheDocument();
  });

  it('shows empty state when no appointment types found (admin)', async () => {
    vi.mocked(appointmentTypesList).mockResolvedValueOnce(
      makePagedResponse([], 0)
    );

    renderAppointmentTypesTable('admin');

    const emptyText = await screen.findByText('No appointment types found.');
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
    vi.mocked(appointmentTypesList).mockResolvedValue(
      makePagedResponse(mockAppointmentTypes, 2)
    );

    const { unmount } = renderAppointmentTypesTable('admin');
    expect(
      await screen.findByRole('button', {
        name: /edit appointment type frontend team/i,
      })
    ).toBeInTheDocument();
    unmount();

    // The member branch filters to appointment types holding a calendar they own; give it
    // one so a row actually renders and the absence of the action is meaningful.
    vi.mocked(calendarList).mockResolvedValue(
      makeCalendarListResponse([ownedCalendar(999)])
    );
    vi.mocked(appointmentTypesList).mockResolvedValue(
      makePagedResponse(makeManyAppointmentTypes(1, 0), 1)
    );

    renderAppointmentTypesTable('member');

    await screen.findByRole('link', { name: 'Appointment Type 1' });
    expect(
      screen.queryByRole('button', { name: /edit appointment type/i })
    ).not.toBeInTheDocument();
  });

  it('names each attached pool once in the Pools column, even across slots', async () => {
    const pooledAppointmentType: AppointmentType = {
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

    vi.mocked(appointmentTypesList).mockResolvedValueOnce(
      makePagedResponse([pooledAppointmentType], 1)
    );

    renderAppointmentTypesTable('admin');

    expect(await screen.findAllByText('Nurses')).toHaveLength(1);
    expect(screen.getByText('Rooms')).toBeInTheDocument();
  });

  it('links the name cell to the appointment type detail route', async () => {
    vi.mocked(appointmentTypesList).mockResolvedValueOnce(
      makePagedResponse(mockAppointmentTypes, 2)
    );

    renderAppointmentTypesTable('admin');

    const link = await screen.findByRole('link', { name: 'Frontend Team' });
    expect(link).toHaveAttribute('href', '/appointment-types/1');

    const secondLink = screen.getByRole('link', { name: 'Backend Team' });
    expect(secondLink).toHaveAttribute('href', '/appointment-types/2');
  });

  // -------------------------------------------------------------------
  // BLOCKER 1 — role === null must fail CLOSED (member-scoped), never
  // fall open into admin chrome.
  // -------------------------------------------------------------------

  it('role === null (not yet resolved) renders member-scoped output: no create affordance, and fetches with a member-shaped large single page, never the admin URL-driven page', async () => {
    vi.mocked(appointmentTypesList).mockResolvedValue(makePagedResponse([], 0));

    renderAppointmentTypesTable(null);

    await waitFor(() => expect(appointmentTypesList).toHaveBeenCalled());

    expect(
      screen.queryByTestId('new-appointment-type-button')
    ).not.toBeInTheDocument();

    const call = vi.mocked(appointmentTypesList).mock.calls[0]?.[0] as
      | { query?: { limit?: number; offset?: number } }
      | undefined;
    // The admin-shaped query would use the URL-driven page size (20, from
    // DEFAULT_DATA_TABLE_QUERY) at offset 0. A member-shaped fetch instead
    // uses the large single-page limit that mirrors useOwnedCalendarIds.
    expect(call?.query?.limit).toBe(OWNED_CALENDARS_PAGE_SIZE);
    expect(call?.query?.offset).toBe(0);
  });

  it('hides the create action and dialog for a member', async () => {
    vi.mocked(appointmentTypesList).mockResolvedValue(makePagedResponse([], 0));

    renderAppointmentTypesTable('member');

    await screen.findByText('No appointment types found.');
    expect(
      screen.queryByTestId('new-appointment-type-button')
    ).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------
  // BLOCKER 2 — a member's owned appointment type must be reachable even when it
  // falls outside the org's first server-paginated page.
  // -------------------------------------------------------------------

  it("a member whose owned appointment type falls outside the org's first server page can still find it", async () => {
    // 25 org appointment types (server default page size is 20); the member's owned
    // appointment type is #25 — on server page 2, unreachable if the ownership filter
    // ran on a single server-paginated page.
    const allAppointmentTypes = makeManyAppointmentTypes(25, 24);
    vi.mocked(appointmentTypesList).mockImplementation((async (options?: {
      query?: { limit?: number; offset?: number };
    }) => {
      const limit = options?.query?.limit ?? allAppointmentTypes.length;
      const offset = options?.query?.offset ?? 0;
      return makePagedResponse(
        allAppointmentTypes.slice(offset, offset + limit),
        allAppointmentTypes.length
      );
    }) as typeof appointmentTypesList);
    vi.mocked(calendarList).mockResolvedValue(
      makeCalendarListResponse([ownedCalendar(999)])
    );

    renderAppointmentTypesTable('member');

    expect(await screen.findByText('Appointment Type 25')).toBeInTheDocument();
    expect(
      screen.queryByText('No appointment types found.')
    ).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1–1 of 1')).toBeInTheDocument();
  });

  describe('get scheduling link action', () => {
    it('shows the action for a member who owns a calendar in the appointment type roster', async () => {
      const appointmentType = makeManyAppointmentTypes(1, 0)[0]!;
      vi.mocked(appointmentTypesList).mockResolvedValueOnce(
        makePagedResponse([appointmentType], 1)
      );
      vi.mocked(calendarList).mockResolvedValue(
        makeCalendarListResponse([ownedCalendar(999)])
      );

      renderAppointmentTypesTable('member');

      expect(
        await screen.findByRole('button', {
          name: `Get scheduling link for ${appointmentType.name}`,
        })
      ).toBeInTheDocument();
    });

    it('shows the action for an admin even for an appointment type with an empty roster', async () => {
      vi.mocked(appointmentTypesList).mockResolvedValueOnce(
        makePagedResponse(mockAppointmentTypes, 2)
      );

      renderAppointmentTypesTable('admin');

      expect(
        await screen.findByRole('button', {
          name: 'Get scheduling link for Frontend Team',
        })
      ).toBeInTheDocument();
    });

    // The denied case cannot be produced by rendering <AppointmentTypesTable> itself:
    // for a member, `appointmentTypeHasOwnedCalendar` (the pre-existing Phase 2 filter)
    // removes exactly the rows a member would be denied for before this
    // column ever runs, and `permissions === null` holds the whole table in
    // its loading branch. So this exercises the "actions" column's cell
    // renderer directly, the way `createColumns` is exported for.
    it('actions cell renders nothing for a viewer canMintBookingLinkForAppointmentType denies (only reachable by testing the column directly)', () => {
      const appointmentType = makeManyAppointmentTypes(1, 0)[0]!;
      const columns = createColumns([], new Set<number>(), vi.fn(), vi.fn());
      const actionsColumn = columns.find((column) => column.id === 'actions');
      const cell = actionsColumn?.cell as (props: {
        row: { original: AppointmentType };
      }) => ReactNode;

      const { container } = render(
        <>{cell({ row: { original: appointmentType } })}</>
      );

      expect(container).toBeEmptyDOMElement();
    });
  });
});
