/**
 * GroupFormDialog tests — edit mode and the roster-resolution helpers.
 *
 * Create mode is covered by create-group-dialog.test.tsx, which drives the same
 * component through its create-mode binding. This file covers what only edit
 * mode has:
 *
 * - Prefill: a saved slot's flat `calendars` list is split back into "attached
 *   pools" and "individually picked calendars" by subtracting the pools' own
 *   rosters, because the API marks no source on a roster entry.
 * - `pool_ids` is sent for EVERY slot, never omitted — the API reads an omitted
 *   `pool_ids` as "unchanged" on an existing slot but as "no pools" on a new
 *   one, and a renamed slot arrives as a new one.
 * - Dropping a saved slot name — by deleting the slot or by retyping its name —
 *   warns before submit, since the API matches slots by name and removes any
 *   saved slot the payload no longer carries.
 * - A slot-removal rejection (`non_field_errors`) surfaces on the form.
 * - The PATCH body is complete — name and description ride along with slots,
 *   because a group PATCH is only partial for `duration` and
 *   `accepts_public_scheduling`, and those two are left to
 *   PublicSchedulingSettings rather than sent from here.
 *
 * The roster helpers this form uses live in `@/lib/calendar-groups/group-payload`
 * and are covered by that module's own test.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

beforeAll(() => {
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
  if (!global.ResizeObserver) {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarList: vi.fn(),
    calendarPoolsList: vi.fn(),
    calendarGroupsPartialUpdate: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import {
  calendarList,
  calendarPoolsList,
  calendarGroupsPartialUpdate,
} from '@/client/sdk.gen';
import { toast } from 'sonner';
import { GroupFormDialog } from './group-form-dialog';
import type { Calendar, CalendarGroup, CalendarPool } from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function cal(id: number, name: string): Calendar {
  return {
    id,
    name,
    email: `c${id}@x.com`,
    external_id: `e${id}`,
    provider: 'internal',
    calendar_type: 'personal',
  } as Calendar;
}

const CAL_A = cal(1, 'Alice');
const CAL_B = cal(2, 'Bob');
const CAL_C = cal(3, 'Carol');

/** "Nurses" holds Alice and Bob. */
const POOL_NURSES: CalendarPool = {
  id: 7,
  name: 'Nurses',
  description: '',
  calendars: [CAL_A, CAL_B],
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
};

/**
 * A saved group whose only slot has the Nurses pool attached plus Carol picked
 * individually. Its `calendars` is the union the API reports, with no marker
 * saying which entry came from where.
 */
const SAVED_GROUP: CalendarGroup = {
  id: 42,
  name: 'Clinic',
  description: 'Walk-ins',
  public_booking_slug: 'grp-42',
  slots: [
    {
      id: 100,
      name: 'Nurse',
      required_count: 1,
      calendars: [CAL_A, CAL_B, CAL_C],
      pools: [POOL_NURSES],
    },
  ],
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
};

function renderEditDialog(group: CalendarGroup = SAVED_GROUP) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onOpenChange = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const result = render(
    <GroupFormDialog open onOpenChange={onOpenChange} group={group} />,
    { wrapper }
  );
  return { ...result, onOpenChange };
}

function lastUpdateBody() {
  return vi.mocked(calendarGroupsPartialUpdate).mock.calls[0]?.[0]?.body;
}

// ---------------------------------------------------------------------------
// Edit mode
// ---------------------------------------------------------------------------

describe('GroupFormDialog (edit mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(calendarList).mockResolvedValue({
      data: { count: 3, results: [CAL_A, CAL_B, CAL_C] },
      response: new Response('{}', { status: 200 }),
    } as unknown as Awaited<ReturnType<typeof calendarList>>);
    vi.mocked(calendarPoolsList).mockResolvedValue({
      data: { count: 1, results: [POOL_NURSES] },
      response: new Response('{}', { status: 200 }),
    } as unknown as Awaited<ReturnType<typeof calendarPoolsList>>);
    vi.mocked(calendarGroupsPartialUpdate).mockResolvedValue({
      data: SAVED_GROUP,
      response: new Response('{}', { status: 200 }),
    } as unknown as Awaited<ReturnType<typeof calendarGroupsPartialUpdate>>);
  });

  it('prefills the group and splits the saved roster into pools and individual picks', async () => {
    renderEditDialog();

    expect(screen.getByText('Edit calendar group')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Clinic')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Walk-ins')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Nurse')).toBeInTheDocument();

    // The pool contributes Alice + Bob, so only Carol shows as an individual
    // pick — and the roster reads as 3, not 4.
    const slot0 = await screen.findByTestId('slot-editor-0');
    // The pool picker can only label an attached pool once the pool list has
    // resolved, so wait for it rather than asserting on the loading state.
    await waitFor(() => {
      expect(
        within(slot0).getByRole('combobox', { name: /calendar pools/i })
      ).toHaveTextContent('Nurses');
    });
    expect(
      within(slot0).getByRole('combobox', { name: /individual calendars/i })
    ).toHaveTextContent('Carol');
    expect(screen.getByTestId('slot-roster-size-0')).toHaveTextContent(
      'Roster: 3 calendars (2 from pools).'
    );
  });

  it('does not offer the public-scheduling fields in edit mode', () => {
    // Those two belong to PublicSchedulingSettings on the detail page once the
    // group exists — two editors for one setting would be one too many.
    renderEditDialog();

    expect(
      screen.queryByRole('switch', { name: 'Accept public bookings' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('spinbutton', {
        name: 'Appointment length in minutes',
      })
    ).not.toBeInTheDocument();
  });

  it('leaves duration and accepts_public_scheduling out of the PATCH', async () => {
    // Both are tri-state server-side, so their absence is what keeps a roster
    // edit from also rewriting the group's public-scheduling state.
    const user = userEvent.setup();
    renderEditDialog({
      ...SAVED_GROUP,
      accepts_public_scheduling: true,
      duration: '00:45:00',
    });

    await screen.findByTestId('slot-editor-0');
    await user.click(screen.getByTestId('edit-group-submit'));

    await waitFor(() => {
      expect(calendarGroupsPartialUpdate).toHaveBeenCalledOnce();
    });
    const body = lastUpdateBody() as Record<string, unknown>;
    expect('duration' in body).toBe(false);
    expect('accepts_public_scheduling' in body).toBe(false);
  });

  it('PATCHes by id and sends pool_ids for every slot, even one left untouched', async () => {
    const user = userEvent.setup();
    renderEditDialog();

    await screen.findByTestId('slot-editor-0');
    await user.click(screen.getByTestId('edit-group-submit'));

    await waitFor(() => {
      expect(calendarGroupsPartialUpdate).toHaveBeenCalledOnce();
    });

    const call = vi.mocked(calendarGroupsPartialUpdate).mock.calls[0]?.[0];
    expect(call?.path).toEqual({ id: '42' });
    expect(call?.body).toEqual({
      name: 'Clinic',
      description: 'Walk-ins',
      slots: [
        {
          name: 'Nurse',
          order: 0,
          required_count: 1,
          calendar_ids: [3],
          pool_ids: [7],
        },
      ],
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Calendar group updated',
      expect.objectContaining({
        description: expect.stringContaining('Clinic'),
      })
    );
  });

  it('sends an empty pool_ids when every pool is detached, which is how the API is told to detach', async () => {
    const user = userEvent.setup();
    renderEditDialog();

    const slot0 = await screen.findByTestId('slot-editor-0');

    // Detach Nurses, and pick its calendars individually so the roster survives.
    await user.click(
      within(slot0).getByRole('combobox', { name: /individual calendars/i })
    );
    await user.click(await screen.findByRole('option', { name: 'Alice' }));
    await user.keyboard('{Escape}');

    await user.click(
      within(slot0).getByRole('combobox', { name: /calendar pools/i })
    );
    await user.click(await screen.findByRole('option', { name: /^Nurses/ }));
    await user.keyboard('{Escape}');

    await user.click(screen.getByTestId('edit-group-submit'));

    await waitFor(() => {
      expect(calendarGroupsPartialUpdate).toHaveBeenCalledOnce();
    });
    expect(lastUpdateBody()?.slots?.[0]).toMatchObject({
      calendar_ids: [3, 1],
      pool_ids: [],
    });
  });

  it('warns that retyping a slot name removes the saved slot', async () => {
    const user = userEvent.setup();
    renderEditDialog();

    await screen.findByTestId('slot-editor-0');
    expect(
      screen.queryByTestId('dropped-slots-warning')
    ).not.toBeInTheDocument();

    const nameInput = screen.getByDisplayValue('Nurse');
    await user.clear(nameInput);
    await user.type(nameInput, 'Senior nurse');

    const warning = await screen.findByTestId('dropped-slots-warning');
    expect(warning).toHaveTextContent('Nurse');
    expect(warning).toHaveTextContent(/removed on save/i);
  });

  it('warns when a saved slot is deleted outright', async () => {
    const user = userEvent.setup();
    renderEditDialog({
      ...SAVED_GROUP,
      slots: [
        SAVED_GROUP.slots[0],
        { ...SAVED_GROUP.slots[0], id: 101, name: 'Room', pools: [] },
      ],
    });

    await screen.findByTestId('slot-editor-1');
    expect(
      screen.queryByTestId('dropped-slots-warning')
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /remove slot 2/i }));

    const warning = await screen.findByTestId('dropped-slots-warning');
    expect(warning).toHaveTextContent('Room');
  });

  it('surfaces a slot-removal rejection on the form', async () => {
    const user = userEvent.setup();
    vi.mocked(calendarGroupsPartialUpdate).mockRejectedValueOnce({
      non_field_errors: [
        'Cannot remove slot because it is referenced by future group bookings.',
      ],
    });
    renderEditDialog();

    await screen.findByTestId('slot-editor-0');
    await user.click(screen.getByTestId('edit-group-submit'));

    expect(
      await screen.findByText(
        'Cannot remove slot because it is referenced by future group bookings.'
      )
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
