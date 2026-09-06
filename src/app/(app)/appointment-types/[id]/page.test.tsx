import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import type {
  Calendar,
  AppointmentType,
  PaginatedCalendarList,
} from '@/client';
import AppointmentTypeDetailPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  usePathname: vi.fn(() => '/appointment-types/1'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// The four capabilities an "admin" (manage_members) holds; a plain member holds
// none.
const ADMIN_PERMISSIONS = [
  'organizations.manage_members',
  'organizations.manage_organization',
  'organizations.manage_branding',
  'payments.manage_billing',
];
const MEMBER_PERMISSIONS: string[] = [];

// AppointmentTypeDetailPage reads the caller's capabilities via usePermissions. Preserve
// PERMISSIONS (and the rest) so the source's manage_members check resolves.
vi.mock('@/components/navigation/permission-gate', async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import('@/components/navigation/permission-gate')
    >();
  return {
    ...original,
    usePermissions: vi.fn(() => ADMIN_PERMISSIONS),
  };
});

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    appointmentTypesRetrieve: vi.fn(),
    appointmentTypesSlotsAvailabilityWindowsList: vi.fn(),
    appointmentTypesSlotsBlockedTimesList: vi.fn(),
    appointmentTypesSlotsQuotaRulesList: vi.fn(),
    calendarList: vi.fn(),
  };
});

import { usePermissions } from '@/components/navigation/permission-gate';
import {
  appointmentTypesRetrieve,
  appointmentTypesSlotsAvailabilityWindowsList,
  appointmentTypesSlotsBlockedTimesList,
  appointmentTypesSlotsQuotaRulesList,
  calendarList,
} from '@/client/sdk.gen';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_APPOINTMENT_TYPE: AppointmentType = {
  id: 1,
  name: 'Surgery Team',
  description: 'Operating room coverage',
  slots: [
    {
      id: 10,
      name: 'Surgeon',
      required_count: 1,
      calendars: [
        {
          id: 100,
          name: 'Dr. Smith',
          email: 'smith@example.com',
          external_id: 'ext-100',
          provider: 'google',
          calendar_type: 'personal',
        },
        {
          id: 101,
          name: 'Dr. Lee',
          email: 'lee@example.com',
          external_id: 'ext-101',
          provider: 'google',
          calendar_type: 'personal',
        },
      ],
      pools: [],
    },
  ],
  public_booking_slug: 'surgery-team',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AppointmentTypeRetrieveResult = Awaited<
  ReturnType<typeof appointmentTypesRetrieve>
>;

function makeAppointmentTypeResponse(
  appointmentType: AppointmentType
): AppointmentTypeRetrieveResult {
  return {
    data: appointmentType,
    response: new Response(JSON.stringify(appointmentType), { status: 200 }),
  } as unknown as AppointmentTypeRetrieveResult;
}

function make404Response(body: unknown): AppointmentTypeRetrieveResult {
  return {
    data: undefined,
    response: new Response(JSON.stringify(body), { status: 404 }),
  } as unknown as AppointmentTypeRetrieveResult;
}

function makeEmptyListResponse() {
  const body = { count: 0, results: [] };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown;
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

function makeCalendarListResponse(
  results: PaginatedCalendarList['results']
): Awaited<ReturnType<typeof calendarList>> {
  const body: PaginatedCalendarList = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<ReturnType<typeof calendarList>>;
}

async function renderPage(id = '1') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  // AppointmentTypeDetailPage unwraps `params` with React's `use()`, which suspends on
  // its first render even for an already-fulfilled promise — a Suspense
  // boundary is required here for the test to ever commit content, and the
  // render itself must run inside an awaited `act` so React gets a chance to
  // retry after the promise settles.
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>{children}</Suspense>
    </QueryClientProvider>
  );
  let utils!: ReturnType<typeof render>;
  await act(async () => {
    utils = render(
      <AppointmentTypeDetailPage params={Promise.resolve({ id })} />,
      {
        wrapper,
      }
    );
  });
  return utils;
}

describe('AppointmentTypeDetailPage', () => {
  let mockRouter: { replace: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRouter = { replace: vi.fn() };
    vi.mocked(useRouter).mockReturnValue(
      mockRouter as unknown as ReturnType<typeof useRouter>
    );
    vi.mocked(usePermissions).mockReturnValue(ADMIN_PERMISSIONS);
    vi.mocked(calendarList).mockResolvedValue(makeCalendarListResponse([]));
    vi.mocked(appointmentTypesSlotsAvailabilityWindowsList).mockResolvedValue(
      makeEmptyListResponse() as Awaited<
        ReturnType<typeof appointmentTypesSlotsAvailabilityWindowsList>
      >
    );
    vi.mocked(appointmentTypesSlotsBlockedTimesList).mockResolvedValue(
      makeEmptyListResponse() as Awaited<
        ReturnType<typeof appointmentTypesSlotsBlockedTimesList>
      >
    );
    vi.mocked(appointmentTypesSlotsQuotaRulesList).mockResolvedValue(
      makeEmptyListResponse() as Awaited<
        ReturnType<typeof appointmentTypesSlotsQuotaRulesList>
      >
    );
  });

  it('renders slots and rosters from a mocked appointment type', async () => {
    vi.mocked(appointmentTypesRetrieve).mockResolvedValue(
      makeAppointmentTypeResponse(FIXTURE_APPOINTMENT_TYPE)
    );

    await renderPage();

    expect(await screen.findByText('Surgery Team')).toBeInTheDocument();
    expect(screen.getByText('Surgeon')).toBeInTheDocument();
    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    expect(screen.getByText('Dr. Lee')).toBeInTheDocument();
  });

  it('does not fetch the appointment type until the caller role has resolved', async () => {
    vi.mocked(usePermissions).mockReturnValue(null);
    vi.mocked(appointmentTypesRetrieve).mockResolvedValue(
      makeAppointmentTypeResponse(FIXTURE_APPOINTMENT_TYPE)
    );

    await renderPage();

    expect(screen.queryByText('Surgery Team')).not.toBeInTheDocument();
    expect(appointmentTypesRetrieve).not.toHaveBeenCalled();
  });

  it('renders the not-found state on 404, with no router.replace call', async () => {
    vi.mocked(appointmentTypesRetrieve).mockResolvedValue(
      make404Response({ detail: 'Not found.' })
    );

    await renderPage();

    expect(
      await screen.findByTestId('appointment-type-not-found')
    ).toBeInTheDocument();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('renders identical output for missing / other-org / out-of-scope / unauthorized 404s', async () => {
    // Same HTTP status (404) across all four causes, per the API's shared
    // error contract — even when the (hypothetical, leaky) body differs, the
    // page must never surface that difference.
    const fixtures: unknown[] = [
      { detail: 'Not found.' }, // missing
      { detail: 'Not found.', organization: 'other-org' }, // other organization
      {}, // out of scope
      { detail: 'Forbidden.' }, // unauthorized
    ];

    const renders: string[] = [];
    for (const body of fixtures) {
      vi.mocked(appointmentTypesRetrieve).mockResolvedValue(
        make404Response(body)
      );
      const { container, unmount } = await renderPage();
      await waitFor(() =>
        expect(
          screen.getByTestId('appointment-type-not-found')
        ).toBeInTheDocument()
      );
      renders.push(container.innerHTML);
      unmount();
    }

    expect(new Set(renders).size).toBe(1);
  });

  it('as an admin, every roster row is editable', async () => {
    vi.mocked(usePermissions).mockReturnValue(ADMIN_PERMISSIONS);
    vi.mocked(appointmentTypesRetrieve).mockResolvedValue(
      makeAppointmentTypeResponse(FIXTURE_APPOINTMENT_TYPE)
    );

    await renderPage();
    const user = userEvent.setup();

    await screen.findByText('Dr. Smith');
    await user.click(screen.getByTestId('roster-row-100'));
    await user.click(screen.getByTestId('roster-row-101'));

    expect(
      await screen.findByTestId('roster-panel-editable-100')
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId('roster-panel-editable-101')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('roster-row-readonly-badge-100')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('roster-row-readonly-badge-101')
    ).not.toBeInTheDocument();
  });

  it("as a member, the owner's own row is editable and every other row exposes no write control", async () => {
    vi.mocked(usePermissions).mockReturnValue(MEMBER_PERMISSIONS);
    // Owns calendar 100 (Dr. Smith); does not own 101 (Dr. Lee).
    vi.mocked(calendarList).mockResolvedValue(
      makeCalendarListResponse([ownedCalendar(100)])
    );
    vi.mocked(appointmentTypesRetrieve).mockResolvedValue(
      makeAppointmentTypeResponse(FIXTURE_APPOINTMENT_TYPE)
    );

    await renderPage();
    const user = userEvent.setup();

    await screen.findByText('Dr. Smith');
    await user.click(screen.getByTestId('roster-row-100'));
    await user.click(screen.getByTestId('roster-row-101'));

    // Owned row: editable, no read-only badge.
    expect(
      await screen.findByTestId('roster-panel-editable-100')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('roster-row-readonly-badge-100')
    ).not.toBeInTheDocument();

    // Non-owned row: a positive read-only signal is present (so this isn't
    // trivially satisfied by the row failing to render at all)...
    expect(
      await screen.findByTestId('roster-panel-readonly-101')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('roster-row-readonly-badge-101')
    ).toBeInTheDocument();
    // ...and no write control/affordance for it.
    expect(
      screen.queryByTestId('roster-panel-editable-101')
    ).not.toBeInTheDocument();
  });

  it('as a member, the appointment type is not fetched while ownership is still resolving, and nothing renders as editable', async () => {
    vi.mocked(usePermissions).mockReturnValue(MEMBER_PERMISSIONS);
    let resolveCalendarList!: (
      value: Awaited<ReturnType<typeof calendarList>>
    ) => void;
    const pending = new Promise<Awaited<ReturnType<typeof calendarList>>>(
      (resolve) => {
        resolveCalendarList = resolve;
      }
    );
    vi.mocked(calendarList).mockReturnValueOnce(
      pending as ReturnType<typeof calendarList>
    );
    vi.mocked(appointmentTypesRetrieve).mockResolvedValue(
      makeAppointmentTypeResponse(FIXTURE_APPOINTMENT_TYPE)
    );

    await renderPage();

    // Ownership fetch (isOwnedCalendarsLoading) is still in flight — the
    // appointment type fetch must not have fired yet (permissionsReady gate), and
    // nothing editable can have rendered as a result.
    expect(appointmentTypesRetrieve).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId('roster-panel-editable-100')
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveCalendarList(makeCalendarListResponse([ownedCalendar(100)]));
      await pending;
    });

    expect(await screen.findByText('Surgery Team')).toBeInTheDocument();
    expect(appointmentTypesRetrieve).toHaveBeenCalled();
  });

  it('as a member, a failed ownership fetch surfaces an error instead of silently rendering every row read-only', async () => {
    vi.mocked(usePermissions).mockReturnValue(MEMBER_PERMISSIONS);
    vi.mocked(calendarList).mockRejectedValue(new Error('network error'));
    vi.mocked(appointmentTypesRetrieve).mockResolvedValue(
      makeAppointmentTypeResponse(FIXTURE_APPOINTMENT_TYPE)
    );

    await renderPage();

    expect(
      await screen.findByText("Couldn't check which calendars you own.")
    ).toBeInTheDocument();
    // The owned row must not silently render as read-only, indistinguishable
    // from "owns nothing" — nothing from the roster renders at all here.
    expect(
      screen.queryByTestId('roster-panel-editable-100')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('roster-panel-readonly-100')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
