/**
 * GroupBlockList tests.
 *
 * Covers:
 * - a save (through the "Add block" dialog) returning orphaned bookings
 *   renders the shared OrphanedBookingsAlert with the booking on screen;
 * - a recurring block's delete confirms before calling the API, and a
 *   non-recurring block's delete calls directly;
 * - a viewer without edit rights sees the rows (times, timezone, reason)
 *   but no "Add block" button and no edit/delete actions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { GroupScopedBlockedTime } from '@/client';
import { GroupBlockList } from './group-block-list';
import { GroupPermissionsProvider } from './group-permissions-provider';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarGroupsSlotsBlockedTimesList: vi.fn(),
    calendarGroupsSlotsBlockedTimesCreate: vi.fn(),
    calendarGroupsSlotsBlockedTimesPartialUpdate: vi.fn(),
    calendarGroupsSlotsBlockedTimesDestroy: vi.fn(),
  };
});

import {
  calendarGroupsSlotsBlockedTimesList,
  calendarGroupsSlotsBlockedTimesCreate,
  calendarGroupsSlotsBlockedTimesDestroy,
} from '@/client/sdk.gen';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

function makeBlock(
  overrides: Partial<GroupScopedBlockedTime>
): GroupScopedBlockedTime {
  return {
    id: 1,
    calendar_id: 42,
    group_slot_id: 10,
    start_time: '2024-01-02T09:00:00Z',
    end_time: '2024-01-02T17:00:00Z',
    timezone: 'UTC',
    reason: '',
    rrule_string: null,
    is_recurring: false,
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeListResponse(results: GroupScopedBlockedTime[]) {
  const body = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof calendarGroupsSlotsBlockedTimesList>
  >;
}

function renderList(readOnly = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <GroupPermissionsProvider
        role={readOnly ? null : 'admin'}
        ownedCalendarIds={new Set()}
      >
        {children}
      </GroupPermissionsProvider>
    </QueryClientProvider>
  );
  return render(
    <GroupBlockList
      groupId={1}
      slotId={10}
      calendarId={42}
      calendarName='Dr. Reyes'
    />,
    { wrapper }
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GroupBlockList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('a save returning orphaned bookings renders the shared alert', async () => {
    vi.mocked(calendarGroupsSlotsBlockedTimesList).mockResolvedValue(
      makeListResponse([])
    );
    vi.mocked(calendarGroupsSlotsBlockedTimesCreate).mockResolvedValue({
      data: {
        block: makeBlock({ id: 900, reason: 'Conference' }),
        orphaned_bookings: [
          {
            id: 5001,
            calendar_id: 42,
            title: 'Consult with Dr. Reyes',
            start_time: '2024-06-04T13:00:00Z',
            end_time: '2024-06-04T14:00:00Z',
          },
        ],
      },
      response: new Response(null, { status: 201 }),
    } as unknown as Awaited<
      ReturnType<typeof calendarGroupsSlotsBlockedTimesCreate>
    >);

    const user = userEvent.setup();
    renderList();

    await screen.findByTestId('group-block-list');
    expect(screen.getByText('No blocked time configured.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add block/i }));

    const dateInput = await screen.findByLabelText(/date/i);
    await user.clear(dateInput);
    await user.type(dateInput, '2026-09-01');
    const startInput = screen.getByLabelText(/start time/i);
    await user.clear(startInput);
    await user.type(startInput, '09:00');
    const endInput = screen.getByLabelText(/end time/i);
    await user.clear(endInput);
    await user.type(endInput, '17:00');

    await user.click(screen.getByTestId('group-block-submit'));

    expect(
      await screen.findByTestId('orphaned-bookings-alert')
    ).toBeInTheDocument();
    expect(screen.getByText('Consult with Dr. Reyes')).toBeInTheDocument();
    expect(screen.getByText(/nothing was cancelled/i)).toBeInTheDocument();

    // The dialog closed after a successful save -- its form fields are gone,
    // even though the toolbar's own "Add block" trigger button remains.
    expect(screen.queryByLabelText(/date/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId('group-block-submit')).not.toBeInTheDocument();
  });

  it("a recurring block's delete confirms before calling the API", async () => {
    const recurring = makeBlock({
      id: 5,
      rrule_string: 'FREQ=WEEKLY;BYDAY=TU',
      is_recurring: true,
    });
    vi.mocked(calendarGroupsSlotsBlockedTimesList).mockResolvedValue(
      makeListResponse([recurring])
    );

    const user = userEvent.setup();
    renderList();

    await screen.findByTestId('group-block-5');
    await user.click(screen.getByRole('button', { name: 'Delete block 5' }));

    expect(
      await screen.findByText('Delete recurring block')
    ).toBeInTheDocument();
    expect(calendarGroupsSlotsBlockedTimesDestroy).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete series' }));

    await waitFor(() =>
      expect(calendarGroupsSlotsBlockedTimesDestroy).toHaveBeenCalledTimes(1)
    );
    expect(calendarGroupsSlotsBlockedTimesDestroy).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.objectContaining({ id: '5' }) })
    );
  });

  it("a non-recurring block's delete calls the API directly, no confirmation", async () => {
    const oneOff = makeBlock({ id: 6 });
    vi.mocked(calendarGroupsSlotsBlockedTimesList).mockResolvedValue(
      makeListResponse([oneOff])
    );
    vi.mocked(calendarGroupsSlotsBlockedTimesDestroy).mockResolvedValue({
      data: undefined,
      response: new Response(null, { status: 204 }),
    } as unknown as Awaited<
      ReturnType<typeof calendarGroupsSlotsBlockedTimesDestroy>
    >);

    const user = userEvent.setup();
    renderList();

    await screen.findByTestId('group-block-6');
    await user.click(screen.getByRole('button', { name: 'Delete block 6' }));

    expect(
      screen.queryByText('Delete recurring block')
    ).not.toBeInTheDocument();

    await waitFor(() =>
      expect(calendarGroupsSlotsBlockedTimesDestroy).toHaveBeenCalledTimes(1)
    );
    expect(calendarGroupsSlotsBlockedTimesDestroy).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.objectContaining({ id: '6' }) })
    );
  });

  it('a viewer without edit rights sees the rows and no actions', async () => {
    const oneOff = makeBlock({ id: 7, reason: 'Vacation' });
    const recurring = makeBlock({
      id: 8,
      rrule_string: 'FREQ=WEEKLY;BYDAY=MO',
      is_recurring: true,
    });
    vi.mocked(calendarGroupsSlotsBlockedTimesList).mockResolvedValue(
      makeListResponse([oneOff, recurring])
    );

    renderList(true);

    expect(await screen.findByTestId('group-block-7')).toBeInTheDocument();
    expect(screen.getByTestId('group-block-8')).toBeInTheDocument();
    expect(screen.getByText('Reason: Vacation')).toBeInTheDocument();

    // No write affordances at all -- not "Add block", not per-row edit/delete.
    expect(
      screen.queryByRole('button', { name: /add block/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit block 7' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete block 7' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit block 8' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete block 8' })
    ).not.toBeInTheDocument();
    expect(calendarGroupsSlotsBlockedTimesDestroy).not.toHaveBeenCalled();
  });
});
