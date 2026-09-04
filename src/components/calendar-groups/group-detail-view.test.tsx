import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { CalendarGroup } from '@/client';
import { GroupDetailView } from './group-detail-view';
import { GroupPermissionsProvider } from './group-permissions-provider';

// SlotRoster reads the group-scoped list endpoints — stub them so this test
// stays focused on GroupDetailView's own layout (header + per-slot sections).
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarGroupsSlotsAvailabilityWindowsList: vi.fn(),
    calendarGroupsSlotsBlockedTimesList: vi.fn(),
    calendarGroupsSlotsQuotaRulesList: vi.fn(),
  };
});

// MintBookingLinkDialog (mounted once a viewer can mint a link) reads the
// active org's slug through this hook — irrelevant to what the tests below
// assert, and mocking it keeps them from making a real network call.
vi.mock('@/hooks/organizations/use-current-organization', () => ({
  useCurrentOrganization: () => ({ organization: null }),
}));

import {
  calendarGroupsSlotsAvailabilityWindowsList,
  calendarGroupsSlotsBlockedTimesList,
  calendarGroupsSlotsQuotaRulesList,
} from '@/client/sdk.gen';

function makeListResponse() {
  const body = { count: 0, results: [] };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown;
}

function renderView(group: CalendarGroup) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(<GroupDetailView group={group} />, { wrapper });
}

const GROUP: CalendarGroup = {
  id: 1,
  name: 'Surgery Team',
  description: 'Operating room coverage',
  slots: [
    {
      id: 10,
      name: 'Surgeon',
      required_count: 2,
      calendars: [
        {
          id: 100,
          name: 'Dr. Smith',
          email: 'smith@example.com',
          external_id: 'ext-100',
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

describe('GroupDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse() as Awaited<
        ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsList>
      >
    );
    vi.mocked(calendarGroupsSlotsBlockedTimesList).mockResolvedValue(
      makeListResponse() as Awaited<
        ReturnType<typeof calendarGroupsSlotsBlockedTimesList>
      >
    );
    vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse() as Awaited<
        ReturnType<typeof calendarGroupsSlotsQuotaRulesList>
      >
    );
  });

  it('renders the group name, description, and each slot with its required count and roster', () => {
    renderView(GROUP);

    expect(screen.getByText('Surgery Team')).toBeInTheDocument();
    expect(screen.getByText('Operating room coverage')).toBeInTheDocument();
    expect(screen.getByText('Surgeon')).toBeInTheDocument();
    expect(screen.getByText('Requires 2')).toBeInTheDocument();
    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
  });

  it('renders a message when the group has no slots', () => {
    renderView({ ...GROUP, slots: [] });

    expect(screen.getByText('This group has no slots.')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// "Get scheduling link" header action — BLOCKER 3, Phase 1 review: present
// for an authorized viewer, absent for an unauthorized one.
// ---------------------------------------------------------------------------

function renderWithPermissions(
  permissions: readonly string[] | null,
  ownedCalendarIds: ReadonlySet<number>
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <GroupPermissionsProvider
        permissions={permissions}
        ownedCalendarIds={ownedCalendarIds}
      >
        {children}
      </GroupPermissionsProvider>
    </QueryClientProvider>
  );
  return render(<GroupDetailView group={GROUP} />, { wrapper });
}

describe('GroupDetailView — Get scheduling link action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse() as Awaited<
        ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsList>
      >
    );
    vi.mocked(calendarGroupsSlotsBlockedTimesList).mockResolvedValue(
      makeListResponse() as Awaited<
        ReturnType<typeof calendarGroupsSlotsBlockedTimesList>
      >
    );
    vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse() as Awaited<
        ReturnType<typeof calendarGroupsSlotsQuotaRulesList>
      >
    );
  });

  it('is present for a viewer who owns a calendar in the group roster', () => {
    // GROUP.slots[0].calendars contains calendar id 100 (Dr. Smith).
    renderWithPermissions([], new Set([100]));

    expect(
      screen.getByRole('button', { name: 'Get scheduling link' })
    ).toBeInTheDocument();
  });

  it('is absent for a viewer who owns none of the group roster', () => {
    renderWithPermissions([], new Set());

    expect(
      screen.queryByRole('button', { name: 'Get scheduling link' })
    ).not.toBeInTheDocument();
  });

  it('is absent while permissions are unresolved', () => {
    renderWithPermissions(null, new Set([100]));

    expect(
      screen.queryByRole('button', { name: 'Get scheduling link' })
    ).not.toBeInTheDocument();
  });
});
