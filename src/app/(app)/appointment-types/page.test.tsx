import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import type {
  Calendar,
  AppointmentType,
  PaginatedAppointmentTypeList,
  PaginatedCalendarList,
} from '@/client';
import AppointmentTypesPage from './page';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(() => '/appointment-types'),
  useSearchParams: vi.fn(),
}));

// The four capabilities an "admin" (manage_members) holds; a plain member holds
// none. Both mapped in one place so the two mocked hooks below stay in sync.
const ADMIN_PERMISSIONS = [
  'organizations.manage_members',
  'organizations.manage_organization',
  'organizations.manage_branding',
  'payments.manage_billing',
];
const MEMBER_PERMISSIONS: string[] = [];

// Mock the permission gate — AppointmentTypesPage reads capabilities via
// useHasPermission and AppointmentTypesTable via usePermissions (Phase 2 dropped the
// useRequirePermission admin gate). Both are driven off a single mocked
// permissions set. Preserve PERMISSIONS (and the rest) so the real capability
// keys resolve.
vi.mock('@/components/navigation/permission-gate', async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import('@/components/navigation/permission-gate')
    >();
  return {
    ...original,
    usePermissions: vi.fn(() => ADMIN_PERMISSIONS),
    useHasPermission: vi.fn(
      (cap: string) => vi.mocked(usePermissions)()?.includes(cap) ?? false
    ),
  };
});

// Mock the SDK
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    appointmentTypesList: vi.fn(),
    calendarList: vi.fn(),
  };
});

// Import after mocks are set up
import { usePermissions } from '@/components/navigation/permission-gate';
import { appointmentTypesList, calendarList } from '@/client/sdk.gen';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// The same two-appointment-type fixture Phase 1's appointment-types-table.test.tsx uses for the
// admin path, so "admin view unchanged" is asserted against a pre-existing
// shape rather than a fixture invented for this phase.
const ADMIN_FIXTURE_APPOINTMENT_TYPES: AppointmentType[] = [
  {
    id: 1,
    name: 'Frontend Team',
    description: 'For frontend team meetings',
    slots: [
      {
        id: 1,
        name: 'Slot 1',
        required_count: 1,
        calendars: [
          {
            id: 100,
            name: 'Someone else',
            email: 'someone@example.com',
            external_id: 'ext-100',
            provider: 'google',
            calendar_type: 'personal',
          },
        ],
        pools: [],
      },
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
      {
        id: 2,
        name: 'Slot 1',
        required_count: 2,
        calendars: [
          {
            id: 200,
            name: 'My calendar',
            email: 'me@example.com',
            external_id: 'ext-200',
            provider: 'google',
            calendar_type: 'personal',
          },
        ],
        pools: [],
      },
      { id: 3, name: 'Slot 2', required_count: 1, calendars: [], pools: [] },
    ],
    public_booking_slug: 'backend-team',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  },
];

function makeAppointmentTypesListResponse(
  results: PaginatedAppointmentTypeList['results']
): Awaited<ReturnType<typeof appointmentTypesList>> {
  const body: PaginatedAppointmentTypeList = { count: results.length, results };
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
    response: new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  } as unknown as Awaited<ReturnType<typeof calendarList>>;
}

function ownedCalendar(id: number): Calendar {
  return {
    id,
    name: `Owned ${id}`,
    email: `owned-${id}@example.com`,
    external_id: `ext-${id}`,
    provider: 'google',
    calendar_type: 'personal',
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AppointmentTypesPage />
    </QueryClientProvider>
  );
}

describe('AppointmentTypesPage', () => {
  let mockRouter: { replace: (path: string) => void };

  beforeEach(() => {
    mockRouter = { replace: vi.fn() };
    vi.mocked(useRouter).mockReturnValue(
      mockRouter as ReturnType<typeof useRouter>
    );
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as ReturnType<typeof useSearchParams>
    );
    vi.mocked(usePermissions).mockReturnValue(ADMIN_PERMISSIONS);
    vi.mocked(calendarList).mockResolvedValue(makeCalendarListResponse([]));
  });

  it('shows "Appointment types" header and description when admin', () => {
    vi.mocked(appointmentTypesList).mockResolvedValue(
      makeAppointmentTypesListResponse([])
    );

    renderPage();

    expect(screen.getByText('Appointment types')).toBeInTheDocument();
    expect(
      screen.getByText('Manage your organization appointment types.')
    ).toBeInTheDocument();
  });

  it("admin's existing view is unchanged: sees every appointment type and the create action", async () => {
    vi.mocked(appointmentTypesList).mockResolvedValue(
      makeAppointmentTypesListResponse(ADMIN_FIXTURE_APPOINTMENT_TYPES)
    );

    renderPage();

    // Both appointment types render, regardless of which calendars they contain —
    // this is the pre-Phase-2 admin fixture from appointment-types-table.test.tsx,
    // asserted unchanged.
    expect(await screen.findByText('Frontend Team')).toBeInTheDocument();
    expect(screen.getByText('Backend Team')).toBeInTheDocument();
    expect(
      screen.getByTestId('new-appointment-type-button')
    ).toBeInTheDocument();
    // Admin edit access does not depend on ownership, so the ownership
    // lookup (owner='me') is never issued for an admin — note the create
    // dialog's own calendar picker (useAllCalendars) does call calendarList,
    // just never scoped to owner='me'.
    const ownerScopedCalls = vi
      .mocked(calendarList)
      .mock.calls.filter((call) => call[0]?.query?.owner === 'me');
    expect(ownerScopedCalls).toHaveLength(0);
  });

  it('member sees only the appointment type containing a calendar they own, with no create action', async () => {
    vi.mocked(usePermissions).mockReturnValue(MEMBER_PERMISSIONS);
    // Owns calendar 200, which sits in "Backend Team" only.
    vi.mocked(calendarList).mockResolvedValue(
      makeCalendarListResponse([ownedCalendar(200)])
    );
    vi.mocked(appointmentTypesList).mockResolvedValue(
      makeAppointmentTypesListResponse(ADMIN_FIXTURE_APPOINTMENT_TYPES)
    );

    renderPage();

    expect(await screen.findByText('Backend Team')).toBeInTheDocument();
    expect(screen.queryByText('Frontend Team')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('new-appointment-type-button')
    ).not.toBeInTheDocument();
  });

  it('member with no owned calendars in any appointment type sees the ordinary empty state', async () => {
    vi.mocked(usePermissions).mockReturnValue(MEMBER_PERMISSIONS);
    vi.mocked(calendarList).mockResolvedValue(makeCalendarListResponse([]));
    vi.mocked(appointmentTypesList).mockResolvedValue(
      makeAppointmentTypesListResponse(ADMIN_FIXTURE_APPOINTMENT_TYPES)
    );

    renderPage();

    expect(
      await screen.findByText('No appointment types found.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Frontend Team')).not.toBeInTheDocument();
    expect(screen.queryByText('Backend Team')).not.toBeInTheDocument();
  });
});
