/**
 * GroupWindowGrid tests.
 *
 * Covers:
 * - ticking two weekdays and saving issues exactly two creates, each with a
 *   single-BYDAY weekly rrule;
 * - saving again with no further edits issues nothing (idempotent re-save,
 *   proving the created rows' server ids were reattached to the form);
 * - a double submit (two clicks before the first write settles) issues one
 *   write, not two;
 * - alongside UnsupportedWindowList: a calendar with one weekly row and two
 *   unrepresentable rows renders one grid row and two read-only entries,
 *   and saving the grid never touches the unrepresentable rows' ids -- the
 *   central data-loss-safety property of this phase, proven at the
 *   component level (group-scoped-types.test.ts proves it at the pure-
 *   function level).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type {
  GroupScopedAvailabilityWindow,
  GroupScopedAvailabilityWindowCreate,
} from '@/client';
import { GroupWindowGrid } from './group-window-grid';
import { UnsupportedWindowList } from './unsupported-window-list';
import { GroupPermissionsProvider } from './group-permissions-provider';

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarGroupsSlotsAvailabilityWindowsList: vi.fn(),
    calendarGroupsSlotsAvailabilityWindowsCreate: vi.fn(),
    calendarGroupsSlotsAvailabilityWindowsPartialUpdate: vi.fn(),
    calendarGroupsSlotsAvailabilityWindowsDestroy: vi.fn(),
  };
});

import {
  calendarGroupsSlotsAvailabilityWindowsList,
  calendarGroupsSlotsAvailabilityWindowsCreate,
  calendarGroupsSlotsAvailabilityWindowsPartialUpdate,
  calendarGroupsSlotsAvailabilityWindowsDestroy,
} from '@/client/sdk.gen';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

function makeWindow(
  overrides: Partial<GroupScopedAvailabilityWindow>
): GroupScopedAvailabilityWindow {
  return {
    id: 1,
    calendar_id: 42,
    group_slot_id: 10,
    start_time: '2024-01-02T09:00:00Z', // Tuesday
    end_time: '2024-01-02T17:00:00Z',
    timezone: 'UTC',
    rrule_string: 'FREQ=WEEKLY;BYDAY=TU',
    is_recurring: true,
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeListResponse(results: GroupScopedAvailabilityWindow[]) {
  const body = { count: results.length, results };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<
    ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsList>
  >;
}

function makeCreateResponse(window: GroupScopedAvailabilityWindow) {
  return {
    data: { window, orphaned_bookings: [] },
    response: new Response(null, { status: 201 }),
  } as unknown as Awaited<
    ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsCreate>
  >;
}

function makeDestroyResponse(status: number) {
  return {
    data: undefined,
    response: new Response(null, { status }),
  } as unknown as Awaited<
    ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsDestroy>
  >;
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderGrid(queryClient: QueryClient, readOnly = false) {
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
  return render(<GroupWindowGrid groupId={1} slotId={10} calendarId={42} />, {
    wrapper,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GroupWindowGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ticking two weekdays and saving issues exactly two creates with single-BYDAY weekly rrules', async () => {
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([])
    );
    let nextId = 900;
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate).mockImplementation(
      (async (opts: { body: GroupScopedAvailabilityWindowCreate }) =>
        makeCreateResponse(
          makeWindow({
            id: nextId++,
            start_time: opts.body.start_time,
            end_time: opts.body.end_time,
            timezone: opts.body.timezone,
            rrule_string: opts.body.rrule_string ?? null,
          })
        )) as unknown as typeof calendarGroupsSlotsAvailabilityWindowsCreate
    );

    const queryClient = makeQueryClient();
    const user = userEvent.setup();
    renderGrid(queryClient);

    await screen.findByText('Weekly availability');

    await user.click(
      screen.getByRole('button', { name: 'Add Tuesday window' })
    );
    await user.clear(screen.getByLabelText('Tuesday window 1 start time'));
    await user.type(
      screen.getByLabelText('Tuesday window 1 start time'),
      '09:00'
    );
    await user.clear(screen.getByLabelText('Tuesday window 1 end time'));
    await user.type(
      screen.getByLabelText('Tuesday window 1 end time'),
      '17:00'
    );

    await user.click(
      screen.getByRole('button', { name: 'Add Thursday window' })
    );
    await user.clear(screen.getByLabelText('Thursday window 1 start time'));
    await user.type(
      screen.getByLabelText('Thursday window 1 start time'),
      '09:00'
    );
    await user.clear(screen.getByLabelText('Thursday window 1 end time'));
    await user.type(
      screen.getByLabelText('Thursday window 1 end time'),
      '17:00'
    );

    await user.click(screen.getByRole('button', { name: /save windows/i }));

    await waitFor(() =>
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
      ).toHaveBeenCalledTimes(2)
    );

    const rruleStrings = vi
      .mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
      .mock.calls.map(
        (call) =>
          (call[0] as { body: { rrule_string: string } }).body.rrule_string
      )
      .sort();
    expect(rruleStrings).toEqual([
      'FREQ=WEEKLY;BYDAY=TH',
      'FREQ=WEEKLY;BYDAY=TU',
    ]);
    // No updates or deletes for a grid that started empty.
    expect(
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsPartialUpdate)
    ).not.toHaveBeenCalled();
    expect(
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsDestroy)
    ).not.toHaveBeenCalled();
  });

  it('saving again with no further edits issues no additional writes', async () => {
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([])
    );
    let nextId = 900;
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate).mockImplementation(
      (async (opts: { body: GroupScopedAvailabilityWindowCreate }) =>
        makeCreateResponse(
          makeWindow({
            id: nextId++,
            start_time: opts.body.start_time,
            end_time: opts.body.end_time,
            timezone: opts.body.timezone,
            rrule_string: opts.body.rrule_string ?? null,
          })
        )) as unknown as typeof calendarGroupsSlotsAvailabilityWindowsCreate
    );

    const queryClient = makeQueryClient();
    const user = userEvent.setup();
    renderGrid(queryClient);

    await screen.findByText('Weekly availability');

    await user.click(
      screen.getByRole('button', { name: 'Add Tuesday window' })
    );
    await user.clear(screen.getByLabelText('Tuesday window 1 start time'));
    await user.type(
      screen.getByLabelText('Tuesday window 1 start time'),
      '09:00'
    );
    await user.clear(screen.getByLabelText('Tuesday window 1 end time'));
    await user.type(
      screen.getByLabelText('Tuesday window 1 end time'),
      '17:00'
    );

    const saveButton = screen.getByRole('button', { name: /save windows/i });
    await user.click(saveButton);

    await waitFor(() =>
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
      ).toHaveBeenCalledTimes(1)
    );

    // Save again -- no edits made in between. The created row's server id
    // must have been reattached to the form, or this would re-create it.
    await user.click(screen.getByRole('button', { name: /save windows/i }));

    // Give any (incorrect) async write a chance to fire before asserting.
    await waitFor(() => {
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
      ).toHaveBeenCalledTimes(1);
    });
    expect(
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsPartialUpdate)
    ).not.toHaveBeenCalled();
    expect(
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsDestroy)
    ).not.toHaveBeenCalled();
  });

  it('a double submit issues one write, not two', async () => {
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([])
    );
    let resolveCreate: (
      value: Awaited<
        ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsCreate>
      >
    ) => void = () => {};
    const pending = new Promise<
      Awaited<ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsCreate>>
    >((resolve) => {
      resolveCreate = resolve;
    });
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate).mockReturnValue(
      pending as ReturnType<typeof calendarGroupsSlotsAvailabilityWindowsCreate>
    );

    const queryClient = makeQueryClient();
    const user = userEvent.setup();
    renderGrid(queryClient);

    await screen.findByText('Weekly availability');

    await user.click(
      screen.getByRole('button', { name: 'Add Tuesday window' })
    );
    await user.clear(screen.getByLabelText('Tuesday window 1 start time'));
    await user.type(
      screen.getByLabelText('Tuesday window 1 start time'),
      '09:00'
    );
    await user.clear(screen.getByLabelText('Tuesday window 1 end time'));
    await user.type(
      screen.getByLabelText('Tuesday window 1 end time'),
      '17:00'
    );

    const saveButton = screen.getByRole('button', { name: /save windows/i });
    await user.click(saveButton);
    // Second click while the first write is still in flight -- the button
    // should already be disabled, and the submit handler itself guards
    // against a literal double invocation regardless.
    await user.click(saveButton);

    resolveCreate(makeCreateResponse(makeWindow({ id: 901 })));

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /save windows/i })
      ).toBeEnabled()
    );

    expect(
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
    ).toHaveBeenCalledTimes(1);
  });

  it('renders one grid row and two read-only entries, and saving the grid never touches the unrepresentable rows’ ids', async () => {
    const representable = makeWindow({ id: 1 }); // TU 09:00-17:00, weekly
    const oneOff = makeWindow({
      id: 2,
      rrule_string: null,
      is_recurring: false,
    });
    const multiDay = makeWindow({
      id: 3,
      rrule_string: 'FREQ=WEEKLY;BYDAY=MO,TU',
    });

    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([representable, oneOff, multiDay])
    );
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsDestroy).mockResolvedValue(
      makeDestroyResponse(204)
    );

    const queryClient = makeQueryClient();
    const user = userEvent.setup();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <GroupPermissionsProvider role='admin' ownedCalendarIds={new Set()}>
          {children}
        </GroupPermissionsProvider>
      </QueryClientProvider>
    );
    render(
      <div>
        <GroupWindowGrid groupId={1} slotId={10} calendarId={42} />
        <UnsupportedWindowList groupId={1} slotId={10} calendarId={42} />
      </div>,
      { wrapper }
    );

    await screen.findByText('Weekly availability');

    // Exactly one grid row (the single representable window).
    expect(screen.getAllByLabelText(/window \d+ start time/)).toHaveLength(1);
    expect(screen.getByLabelText('Tuesday window 1 start time')).toHaveValue(
      '09:00'
    );

    // Exactly two read-only entries for the unrepresentable windows.
    const list = await screen.findByTestId('unsupported-window-list');
    expect(
      within(list).getByTestId('unsupported-window-2')
    ).toBeInTheDocument();
    expect(
      within(list).getByTestId('unsupported-window-3')
    ).toBeInTheDocument();

    // Remove the one grid row and save -- only id 1 may be deleted.
    await user.click(
      screen.getByRole('button', { name: 'Remove Tuesday window 1' })
    );
    await user.click(screen.getByRole('button', { name: /save windows/i }));

    await waitFor(() =>
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsDestroy)
      ).toHaveBeenCalledTimes(1)
    );
    expect(
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsDestroy)
    ).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.objectContaining({ id: '1' }) })
    );
    expect(
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
    ).not.toHaveBeenCalled();
    expect(
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsPartialUpdate)
    ).not.toHaveBeenCalled();
  });

  it('renders a read-only summary with no inputs when readOnly is true', async () => {
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([makeWindow({ id: 1 })])
    );

    const queryClient = makeQueryClient();
    renderGrid(queryClient, true);

    await screen.findByText('Weekly availability');

    expect(screen.getByText('09:00–17:00')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /save windows/i })
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  });
});
