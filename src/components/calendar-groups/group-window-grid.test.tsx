/**
 * GroupWindowGrid tests.
 *
 * Covers:
 * - ticking two weekdays and saving issues exactly two creates, each with a
 *   single-BYDAY weekly rrule;
 * - saving again with no further edits issues nothing (idempotent re-save,
 *   proving the created rows' server ids were reattached to the form);
 * - a double submit (two `fireEvent.submit`s with no `await` between them --
 *   the actual double-invocation hazard the ref guard in onSubmit defends
 *   against) issues one write, not two;
 * - a partially-failed save (one of three creates rejects) followed by a
 *   retry does not re-create the writes that already succeeded (BLOCKER 2
 *   regression -- see group-scoped-types.ts's classifyWindow doc and the
 *   phase-3b review);
 * - alongside UnsupportedWindowList: a calendar with one weekly row and two
 *   unrepresentable rows renders one grid row and two read-only entries,
 *   and saving the grid never touches the unrepresentable rows' ids -- the
 *   central data-loss-safety property of this phase, proven at the
 *   component level (group-scoped-types.test.ts proves it at the pure-
 *   function level).
 *
 * Phase 3c additions:
 * - a save whose write returns orphaned bookings renders the alert with the
 *   booking on screen, and the write itself still landed (not rolled back);
 * - a single-write save rejected as over-limit renders the over-limit
 *   alert, leaves the author's edited fields on screen, and leaves the
 *   loaded rows unchanged -- proven by retrying and observing the SAME
 *   create is reissued, not skipped as a no-op;
 * - an over-limit rejection alongside an ALREADY-SUCCEEDED write in the
 *   same batch (Promise.allSettled, not Promise.all) reports what was kept
 *   rather than claiming nothing was written -- the conflict the phase
 *   flagged between the plan's "creates nothing" acceptance line and
 *   Phase 3b's partial-success reconciliation, resolved here in favor of
 *   accuracy (see the phase report for the full writeup);
 * - a 404 on update (the row was deleted server-side between load and
 *   save) renders the "no longer exists" toast, clears the form's now-
 *   stale sourceId (proven by a follow-up save reissuing a CREATE instead
 *   of silently doing nothing), and triggers a refetch of the window list.
 *
 * Phase 3c review fix:
 * - a batch whose rejections mix an over-limit failure with an unrelated
 *   ordinary failure renders BOTH the over-limit alert and a toast for the
 *   ordinary one, rather than the ordinary failure silently going
 *   unreported because `overLimit` alone gated the `else if` branch.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type {
  GroupScopedAvailabilityOrphanedBooking,
  GroupScopedAvailabilityWindow,
  GroupScopedAvailabilityWindowCreate,
} from '@/client';
import { GroupWindowGrid } from './group-window-grid';
import { UnsupportedWindowList } from './unsupported-window-list';
import { GroupPermissionsProvider } from './group-permissions-provider';

// Mocked so the "gone" test can assert the toast.info call directly --
// without this, sonner's real singleton store still accepts the calls (no
// throw) but nothing renders in a test with no mounted <Toaster/>, so there
// would be no way to assert on the message.
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

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
import { toast } from 'sonner';

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

function makeCreateResponse(
  window: GroupScopedAvailabilityWindow,
  orphanedBookings: GroupScopedAvailabilityOrphanedBooking[] = []
) {
  return {
    data: { window, orphaned_bookings: orphanedBookings },
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

// The shared over-limit rejection body (see @/lib/utils/api-errors.ts) --
// thrown directly by a mocked create/update, mirroring what the generated
// mutation factory's `throwOnError:true` path actually throws: the parsed
// body, not an Error instance.
const OVER_LIMIT_BODY = {
  code: 'limit_exceeded',
  resource: 'availability_windows',
  current_usage: 50,
  limit: 50,
  detail: 'Organization is at its limit for availability windows.',
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderGrid(queryClient: QueryClient, readOnly = false) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <GroupPermissionsProvider
        permissions={readOnly ? null : ['organizations.manage_members']}
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
    const { container } = renderGrid(queryClient);

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

    const form = container.querySelector('form');
    if (!form) throw new Error('form element not found');

    // Two submits with NO `await` between them -- this is the actual
    // double-submit hazard the ref guard in onSubmit defends against. A
    // click-based test doesn't exercise it: userEvent's `await user.click`
    // flushes a React render between clicks, so a second click always lands
    // on an already-disabled Save button and never reaches onSubmit at all
    // -- which is why a state-only guard (`if (isSaving) return`, read from
    // a stale closure) can pass that kind of test while doing nothing.
    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

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

  it('a retry after a partially-failed save does not re-create the writes that already succeeded', async () => {
    // BLOCKER 2 regression: `Promise.all` used to reject on the FIRST
    // failure and skip updating the diff baseline entirely, even though a
    // create earlier in the batch had already succeeded and written its
    // server id into the form. A retry then saw that id as unrecognized by
    // the (stale) baseline and re-created it. Three concurrent creates,
    // the middle one rejecting, mirrors the phase's documented "an
    // over-limit 402 falls through to the ordinary error toast" case: the
    // write that fails is not necessarily the last one issued.
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([])
    );

    let callCount = 0;
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate).mockImplementation(
      (async (opts: { body: GroupScopedAvailabilityWindowCreate }) => {
        callCount += 1;
        if (callCount === 2) {
          throw new Error('simulated write failure');
        }
        return makeCreateResponse(
          makeWindow({
            id: 900 + callCount,
            start_time: opts.body.start_time,
            end_time: opts.body.end_time,
            timezone: opts.body.timezone,
            rrule_string: opts.body.rrule_string ?? null,
          })
        );
      }) as unknown as typeof calendarGroupsSlotsAvailabilityWindowsCreate
    );

    const queryClient = makeQueryClient();
    const user = userEvent.setup();
    renderGrid(queryClient);

    await screen.findByText('Weekly availability');

    for (const day of ['Monday', 'Tuesday', 'Wednesday']) {
      await user.click(
        screen.getByRole('button', { name: `Add ${day} window` })
      );
      await user.clear(screen.getByLabelText(`${day} window 1 start time`));
      await user.type(
        screen.getByLabelText(`${day} window 1 start time`),
        '09:00'
      );
      await user.clear(screen.getByLabelText(`${day} window 1 end time`));
      await user.type(
        screen.getByLabelText(`${day} window 1 end time`),
        '17:00'
      );
    }

    const saveButton = screen.getByRole('button', { name: /save windows/i });
    await user.click(saveButton);

    await waitFor(() =>
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
      ).toHaveBeenCalledTimes(3)
    );
    await waitFor(() => expect(saveButton).toBeEnabled());

    // Retry with no further edits. Only the row whose create failed
    // (Tuesday, the 2nd call) should be re-issued -- Monday and Wednesday
    // already have server ids and must not be re-created.
    await user.click(saveButton);

    await waitFor(() =>
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
      ).toHaveBeenCalledTimes(4)
    );
    await waitFor(() => expect(saveButton).toBeEnabled());

    // Give an (incorrect) duplicate retry of the already-succeeded rows a
    // chance to fire before asserting the ceiling.
    expect(
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
    ).toHaveBeenCalledTimes(4);
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
        <GroupPermissionsProvider
          permissions={['organizations.manage_members']}
          ownedCalendarIds={new Set()}
        >
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

  it('a save whose write returns orphaned bookings renders the alert, and the write still lands', async () => {
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([])
    );
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate).mockImplementation(
      (async (opts: { body: GroupScopedAvailabilityWindowCreate }) =>
        makeCreateResponse(
          makeWindow({
            id: 901,
            start_time: opts.body.start_time,
            end_time: opts.body.end_time,
            timezone: opts.body.timezone,
            rrule_string: opts.body.rrule_string ?? null,
          }),
          [
            {
              id: 5001,
              calendar_id: 42,
              title: 'Consult with Dr. Reyes',
              start_time: '2024-06-04T13:00:00Z',
              end_time: '2024-06-04T14:00:00Z',
            },
          ]
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

    await user.click(screen.getByRole('button', { name: /save windows/i }));

    await waitFor(() =>
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
      ).toHaveBeenCalledTimes(1)
    );

    expect(
      await screen.findByTestId('orphaned-bookings-alert')
    ).toBeInTheDocument();
    expect(screen.getByText('Consult with Dr. Reyes')).toBeInTheDocument();
    expect(screen.getByText(/nothing was cancelled/i)).toBeInTheDocument();

    // The write actually landed -- re-saving with no further edits issues
    // nothing more (the created row's server id was reattached to the
    // form), proving the orphan alert didn't come at the cost of the save
    // itself being reverted or retried.
    await user.click(screen.getByRole('button', { name: /save windows/i }));
    await waitFor(() =>
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
      ).toHaveBeenCalledTimes(1)
    );
  });

  it('a single-write save rejected as over-limit renders the alert, keeps the edited fields, and leaves the loaded rows unchanged', async () => {
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([])
    );
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate).mockImplementation(
      (async () => {
        throw OVER_LIMIT_BODY;
      }) as unknown as typeof calendarGroupsSlotsAvailabilityWindowsCreate
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

    await user.click(screen.getByRole('button', { name: /save windows/i }));

    expect(await screen.findByTestId('over-limit-alert')).toBeInTheDocument();
    expect(screen.getByText(/50 of 50 used/)).toBeInTheDocument();
    expect(
      screen.getByText(/nothing else in this save was applied/i)
    ).toBeInTheDocument();

    // The author's edit is still on screen -- not reverted to the previous
    // (empty) state, so they can undo just the offending row and retry.
    expect(screen.getByLabelText('Tuesday window 1 start time')).toHaveValue(
      '09:00'
    );
    expect(screen.getByLabelText('Tuesday window 1 end time')).toHaveValue(
      '17:00'
    );

    expect(
      vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
    ).toHaveBeenCalledTimes(1);

    // Retrying re-issues the SAME create -- the rejected write was never
    // folded into the diff baseline as though it had succeeded, so the
    // "loaded rows" this diffs against are still exactly what they were
    // before the attempt (acceptance: a rejected save "creates nothing").
    await user.click(screen.getByRole('button', { name: /save windows/i }));
    await waitFor(() =>
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
      ).toHaveBeenCalledTimes(2)
    );
  });

  it('an over-limit rejection alongside an already-succeeded write in the same batch reports what was kept, not that nothing was written', async () => {
    // The plan's acceptance line says a rejected save "creates nothing",
    // but Phase 3b's Promise.allSettled reconciliation means an earlier
    // write in the SAME batch can already have reached the server before a
    // later one is rejected as over-limit. This test proves which one
    // actually happens -- see the phase report for the full writeup of the
    // conflict.
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([])
    );
    let callCount = 0;
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate).mockImplementation(
      (async (opts: { body: GroupScopedAvailabilityWindowCreate }) => {
        callCount += 1;
        if (callCount === 2) {
          throw OVER_LIMIT_BODY;
        }
        return makeCreateResponse(
          makeWindow({
            id: 900 + callCount,
            start_time: opts.body.start_time,
            end_time: opts.body.end_time,
            timezone: opts.body.timezone,
            rrule_string: opts.body.rrule_string ?? null,
          })
        );
      }) as unknown as typeof calendarGroupsSlotsAvailabilityWindowsCreate
    );

    const queryClient = makeQueryClient();
    const user = userEvent.setup();
    renderGrid(queryClient);

    await screen.findByText('Weekly availability');

    for (const day of ['Tuesday', 'Thursday']) {
      await user.click(
        screen.getByRole('button', { name: `Add ${day} window` })
      );
      await user.clear(screen.getByLabelText(`${day} window 1 start time`));
      await user.type(
        screen.getByLabelText(`${day} window 1 start time`),
        '09:00'
      );
      await user.clear(screen.getByLabelText(`${day} window 1 end time`));
      await user.type(
        screen.getByLabelText(`${day} window 1 end time`),
        '17:00'
      );
    }

    await user.click(screen.getByRole('button', { name: /save windows/i }));

    await waitFor(() =>
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
      ).toHaveBeenCalledTimes(2)
    );

    expect(await screen.findByTestId('over-limit-alert')).toBeInTheDocument();
    // Tuesday's create (call 1) succeeded before Thursday's (call 2) was
    // rejected -- the alert must say so, not claim nothing was written.
    expect(
      screen.getByText(
        /1 other change in this save already went through and was kept/i
      )
    ).toBeInTheDocument();

    // Re-saving with no further edits re-issues ONLY the failed (Thursday)
    // write -- the succeeded (Tuesday) one must not be recreated.
    await user.click(screen.getByRole('button', { name: /save windows/i }));
    await waitFor(() =>
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
      ).toHaveBeenCalledTimes(3)
    );
  });

  it('a mixed batch (over-limit + an unrelated ordinary failure) reports both, not just the over-limit one', async () => {
    // Reviewer finding (Phase 3c): `overLimit` being truthy short-circuited
    // the `else if (failures.length > 0)` branch, so an ordinary failure
    // riding alongside an over-limit one in the same batch never reached a
    // toast -- the admin saw only the over-limit alert and had no signal
    // that a second, unrelated edit also needed a retry.
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([])
    );
    let callCount = 0;
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate).mockImplementation(
      (async (opts: { body: GroupScopedAvailabilityWindowCreate }) => {
        callCount += 1;
        // computeGridDiff/onSubmit iterate weekdays in Monday..Sunday order
        // regardless of click order, so Tuesday is call 1, Wednesday call
        // 2, Thursday call 3.
        if (callCount === 2) {
          throw new Error('simulated write failure');
        }
        if (callCount === 3) {
          throw OVER_LIMIT_BODY;
        }
        return makeCreateResponse(
          makeWindow({
            id: 900 + callCount,
            start_time: opts.body.start_time,
            end_time: opts.body.end_time,
            timezone: opts.body.timezone,
            rrule_string: opts.body.rrule_string ?? null,
          })
        );
      }) as unknown as typeof calendarGroupsSlotsAvailabilityWindowsCreate
    );

    const queryClient = makeQueryClient();
    const user = userEvent.setup();
    renderGrid(queryClient);

    await screen.findByText('Weekly availability');

    for (const day of ['Tuesday', 'Wednesday', 'Thursday']) {
      await user.click(
        screen.getByRole('button', { name: `Add ${day} window` })
      );
      await user.clear(screen.getByLabelText(`${day} window 1 start time`));
      await user.type(
        screen.getByLabelText(`${day} window 1 start time`),
        '09:00'
      );
      await user.clear(screen.getByLabelText(`${day} window 1 end time`));
      await user.type(
        screen.getByLabelText(`${day} window 1 end time`),
        '17:00'
      );
    }

    await user.click(screen.getByRole('button', { name: /save windows/i }));

    await waitFor(() =>
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
      ).toHaveBeenCalledTimes(3)
    );

    // The over-limit alert (Thursday) still renders, counting Tuesday's
    // already-succeeded write.
    expect(await screen.findByTestId('over-limit-alert')).toBeInTheDocument();
    expect(
      screen.getByText(
        /1 other change in this save already went through and was kept/i
      )
    ).toBeInTheDocument();

    // The unrelated ordinary failure (Wednesday) must ALSO be reported --
    // this is the assertion the finding says was missing.
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to save some availability windows',
        expect.objectContaining({
          description: expect.stringContaining('1 of 3 writes failed'),
        })
      )
    );

    // Retrying reissues only the two failed writes (Wednesday, Thursday) --
    // Tuesday's already-succeeded create must not be reissued.
    await user.click(screen.getByRole('button', { name: /save windows/i }));
    await waitFor(() =>
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
      ).toHaveBeenCalledTimes(5)
    );
  });

  it('a 404 on update renders the gone message, clears the stale id, and refetches', async () => {
    const existing = makeWindow({ id: 1 }); // Tuesday 09:00-17:00, weekly
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mockResolvedValue(
      makeListResponse([existing])
    );
    vi.mocked(
      calendarGroupsSlotsAvailabilityWindowsPartialUpdate
    ).mockImplementation((async () => {
      throw { detail: 'Not found.' };
    }) as unknown as typeof calendarGroupsSlotsAvailabilityWindowsPartialUpdate);
    vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate).mockImplementation(
      (async (opts: { body: GroupScopedAvailabilityWindowCreate }) =>
        makeCreateResponse(
          makeWindow({
            id: 902,
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

    await user.clear(screen.getByLabelText('Tuesday window 1 end time'));
    await user.type(
      screen.getByLabelText('Tuesday window 1 end time'),
      '18:00'
    );

    const listCallsBeforeSave = vi.mocked(
      calendarGroupsSlotsAvailabilityWindowsList
    ).mock.calls.length;

    await user.click(screen.getByRole('button', { name: /save windows/i }));

    await waitFor(() =>
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsPartialUpdate)
      ).toHaveBeenCalledTimes(1)
    );

    await waitFor(() =>
      expect(toast.info).toHaveBeenCalledWith(
        'This entry no longer exists',
        expect.objectContaining({ description: expect.any(String) })
      )
    );

    // Refetched the window list rather than leaving the stale 404 on
    // screen with no follow-up.
    await waitFor(() =>
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsList).mock.calls.length
      ).toBeGreaterThan(listCallsBeforeSave)
    );

    // The form's now-stale sourceId was cleared -- a follow-up save with no
    // further edits issues a CREATE for this row instead of silently doing
    // nothing, which would leave the admin's edit unsaved with no signal.
    await user.click(screen.getByRole('button', { name: /save windows/i }));
    await waitFor(() =>
      expect(
        vi.mocked(calendarGroupsSlotsAvailabilityWindowsCreate)
      ).toHaveBeenCalledTimes(1)
    );
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
