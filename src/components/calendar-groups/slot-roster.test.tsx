import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { CalendarGroupSlot } from '@/client';
import { SlotRoster } from './slot-roster';
import { GroupPermissionsProvider } from './group-permissions';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarGroupsSlotsAvailabilityWindowsList: vi.fn(),
    calendarGroupsSlotsBlockedTimesList: vi.fn(),
    calendarGroupsSlotsQuotaRulesList: vi.fn(),
  };
});

import {
  calendarGroupsSlotsAvailabilityWindowsList,
  calendarGroupsSlotsBlockedTimesList,
  calendarGroupsSlotsQuotaRulesList,
} from '@/client/sdk.gen';

const SLOT: CalendarGroupSlot = {
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
      name: 'Recovery Room A',
      email: 'room-a@example.com',
      external_id: 'ext-101',
      provider: 'google',
      calendar_type: 'resource',
    },
  ],
};

function makeListResponse<T>(results: T[]) {
  const body = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown;
}

function renderRoster({
  role,
  ownedCalendarIds,
}: {
  role?: 'admin' | 'member' | null;
  ownedCalendarIds?: ReadonlySet<number>;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <GroupPermissionsProvider
        role={role ?? null}
        ownedCalendarIds={ownedCalendarIds ?? new Set()}
      >
        {children}
      </GroupPermissionsProvider>
    </QueryClientProvider>
  );
  return render(<SlotRoster groupId={1} slot={SLOT} />, { wrapper });
}

describe('SlotRoster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders each calendar with its type and a configuration summary', async () => {
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([{ calendar_id: 100 }, { calendar_id: 100 }]) as Awaited<
        ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsList>
      >
    );
    vi.mocked(calendarGroupsSlotsBlockedTimesList).mockResolvedValue(
      makeListResponse([{ calendar_id: 100 }]) as Awaited<
        ReturnType<typeof calendarGroupsSlotsBlockedTimesList>
      >
    );
    vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof calendarGroupsSlotsQuotaRulesList>
      >
    );

    renderRoster();

    expect(await screen.findByText('Dr. Smith')).toBeInTheDocument();
    expect(screen.getByText('Recovery Room A')).toBeInTheDocument();
    expect(screen.getByText('Personal')).toBeInTheDocument();
    expect(screen.getByText('Resource')).toBeInTheDocument();

    const row = screen.getByTestId('roster-row-100');
    expect(
      await within(row).findByText('2 windows · 1 block · 0 quota rules')
    ).toBeInTheDocument();

    const emptyRow = screen.getByTestId('roster-row-101');
    expect(
      await within(emptyRow).findByText('0 windows · 0 blocks · 0 quota rules')
    ).toBeInTheDocument();
  });

  it('renders 200+ instead of a precise count when a concept is truncated', async () => {
    // count (201) exceeds SUMMARY_PAGE_SIZE (200): the summary cannot back
    // up an exact number, so it must show a truncation indicator instead.
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue({
      data: { count: 201, results: [{ calendar_id: 100 }] },
      response: new Response(
        JSON.stringify({ count: 201, results: [{ calendar_id: 100 }] }),
        { status: 200 }
      ),
    } as unknown as Awaited<
      ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsList>
    >);
    vi.mocked(calendarGroupsSlotsBlockedTimesList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof calendarGroupsSlotsBlockedTimesList>
      >
    );
    vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof calendarGroupsSlotsQuotaRulesList>
      >
    );

    renderRoster();

    const row = screen.getByTestId('roster-row-100');
    expect(
      await within(row).findByText('200+ configured (exact count unavailable)')
    ).toBeInTheDocument();
  });

  it('expands a row into the panel shell extension point', async () => {
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsList>
      >
    );
    vi.mocked(calendarGroupsSlotsBlockedTimesList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof calendarGroupsSlotsBlockedTimesList>
      >
    );
    vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof calendarGroupsSlotsQuotaRulesList>
      >
    );

    renderRoster();
    const user = userEvent.setup();

    await screen.findByText('Dr. Smith');
    expect(screen.queryByTestId('roster-panel-100')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('roster-row-100'));

    expect(await screen.findByTestId('roster-panel-100')).toBeInTheDocument();
  });

  it('admin sees every row as editable, with no read-only badge', async () => {
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsList>
      >
    );
    vi.mocked(calendarGroupsSlotsBlockedTimesList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof calendarGroupsSlotsBlockedTimesList>
      >
    );
    vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof calendarGroupsSlotsQuotaRulesList>
      >
    );

    renderRoster({ role: 'admin' });
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

  it('member sees only their owned calendar as editable; every other row exposes no write control', async () => {
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsList>
      >
    );
    vi.mocked(calendarGroupsSlotsBlockedTimesList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof calendarGroupsSlotsBlockedTimesList>
      >
    );
    vi.mocked(calendarGroupsSlotsQuotaRulesList).mockResolvedValue(
      makeListResponse([]) as Awaited<
        ReturnType<typeof calendarGroupsSlotsQuotaRulesList>
      >
    );

    // Owns calendar 100 (Dr. Smith); does NOT own 101 (Recovery Room A).
    renderRoster({ role: 'member', ownedCalendarIds: new Set([100]) });
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

  it('shows an empty-roster message when the slot has no calendars', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    render(
      <SlotRoster
        groupId={1}
        slot={{ id: 20, name: 'Nurse', required_count: 1, calendars: [] }}
      />,
      { wrapper }
    );

    expect(
      screen.getByText("No calendars in this slot's roster.")
    ).toBeInTheDocument();
  });
});
