import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { AppointmentType } from '@/client';
import { AppointmentTypeDetailView } from './appointment-type-detail-view';
import { AppointmentTypePermissionsProvider } from './appointment-type-permissions-provider';

// SlotRoster reads the appointment-type-scoped list endpoints — stub them so this test
// stays focused on AppointmentTypeDetailView's own layout (header + per-slot sections).
vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    appointmentTypesSlotsAvailabilityWindowsList: vi.fn(),
    appointmentTypesSlotsBlockedTimesList: vi.fn(),
    appointmentTypesSlotsQuotaRulesList: vi.fn(),
  };
});

// MintBookingLinkDialog (mounted once a viewer can mint a link) reads the
// active org's slug through this hook — irrelevant to what the tests below
// assert, and mocking it keeps them from making a real network call.
vi.mock('@/hooks/organizations/use-current-organization', () => ({
  useCurrentOrganization: () => ({ organization: null }),
}));

import {
  appointmentTypesSlotsAvailabilityWindowsList,
  appointmentTypesSlotsBlockedTimesList,
  appointmentTypesSlotsQuotaRulesList,
} from '@/client/sdk.gen';

function makeListResponse() {
  const body = { count: 0, results: [] };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown;
}

function renderView(appointmentType: AppointmentType) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return render(
    <AppointmentTypeDetailView appointmentType={appointmentType} />,
    { wrapper }
  );
}

const APPOINTMENT_TYPE: AppointmentType = {
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

describe('AppointmentTypeDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(appointmentTypesSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse() as Awaited<
        ReturnType<typeof appointmentTypesSlotsAvailabilityWindowsList>
      >
    );
    vi.mocked(appointmentTypesSlotsBlockedTimesList).mockResolvedValue(
      makeListResponse() as Awaited<
        ReturnType<typeof appointmentTypesSlotsBlockedTimesList>
      >
    );
    vi.mocked(appointmentTypesSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse() as Awaited<
        ReturnType<typeof appointmentTypesSlotsQuotaRulesList>
      >
    );
  });

  it('renders the appointment type name, description, and each slot with its required count and roster', () => {
    renderView(APPOINTMENT_TYPE);

    expect(screen.getByText('Surgery Team')).toBeInTheDocument();
    expect(screen.getByText('Operating room coverage')).toBeInTheDocument();
    expect(screen.getByText('Surgeon')).toBeInTheDocument();
    expect(screen.getByText('Requires 2')).toBeInTheDocument();
    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
  });

  it('renders a message when the appointment type has no slots', () => {
    renderView({ ...APPOINTMENT_TYPE, slots: [] });

    expect(
      screen.getByText('This appointment type has no slots.')
    ).toBeInTheDocument();
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
      <AppointmentTypePermissionsProvider
        permissions={permissions}
        ownedCalendarIds={ownedCalendarIds}
      >
        {children}
      </AppointmentTypePermissionsProvider>
    </QueryClientProvider>
  );
  return render(
    <AppointmentTypeDetailView appointmentType={APPOINTMENT_TYPE} />,
    { wrapper }
  );
}

describe('AppointmentTypeDetailView — Get scheduling link action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(appointmentTypesSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse() as Awaited<
        ReturnType<typeof appointmentTypesSlotsAvailabilityWindowsList>
      >
    );
    vi.mocked(appointmentTypesSlotsBlockedTimesList).mockResolvedValue(
      makeListResponse() as Awaited<
        ReturnType<typeof appointmentTypesSlotsBlockedTimesList>
      >
    );
    vi.mocked(appointmentTypesSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse() as Awaited<
        ReturnType<typeof appointmentTypesSlotsQuotaRulesList>
      >
    );
  });

  it('is present for a viewer who owns a calendar in the appointment type roster', () => {
    // APPOINTMENT_TYPE.slots[0].calendars contains calendar id 100 (Dr. Smith).
    renderWithPermissions([], new Set([100]));

    expect(
      screen.getByRole('button', { name: 'Get scheduling link' })
    ).toBeInTheDocument();
  });

  it('is absent for a viewer who owns none of the appointment type roster', () => {
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
