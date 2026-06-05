/**
 * GroupBookingFlow tests.
 *
 * Covers Acceptance scenario 5 (per-slot required-count + per-slot availability):
 * - Per-slot required-count enforcement: cannot submit with too few or too many
 *   calendars selected in a slot.
 * - Only FREE candidates are selectable (busy candidates are disabled).
 * - An unsatisfiable slot (free < required_count) HARD-blocks submit and shows
 *   the unsatisfiable warning.
 * - Success path: a complete, satisfiable selection enables submit and calls
 *   calendarGroupsEventsCreate with the right slot → calendar assignments.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// jsdom polyfills for Radix (Select/Dialog/Checkbox)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
    calendarGroupsList: vi.fn(),
    calendarGroupsBookableSlotsList: vi.fn(),
    calendarGroupsAvailabilityCreate: vi.fn(),
    calendarGroupsEventsCreate: vi.fn(),
    calendarEventsList: vi.fn(),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import {
  calendarGroupsList,
  calendarGroupsAvailabilityCreate,
  calendarGroupsEventsCreate,
} from '@/client/sdk.gen';
import { GroupBookingFlow } from './group-booking-flow';
import type {
  Calendar,
  CalendarGroup,
  CalendarGroupSlot,
  CalendarGroupRangeAvailability,
  CalendarEvent,
} from '@/client';

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
    capacity: null,
    is_active: true,
  } as Calendar;
}

// Slot "Nurses": requires 2 of {10,11,12}. Slot "Room": requires 1 of {20,21}.
const SLOT_NURSES: CalendarGroupSlot = {
  id: 1,
  name: 'Nurses',
  required_count: 2,
  calendars: [cal(10, 'Nurse A'), cal(11, 'Nurse B'), cal(12, 'Nurse C')],
};
const SLOT_ROOM: CalendarGroupSlot = {
  id: 2,
  name: 'Room',
  required_count: 1,
  calendars: [cal(20, 'Room 1'), cal(21, 'Room 2')],
};

const GROUP: CalendarGroup = {
  id: 7,
  name: 'Clinic',
  slots: [SLOT_NURSES, SLOT_ROOM],
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
};

const CREATED_EVENT: CalendarEvent = {
  id: 999,
  title: 'Visit',
  start_time: 's',
  end_time: 'e',
  timezone: 'UTC',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
  external_id: 'x',
  external_attendances: [],
  attendances: [],
  resource_allocations: [],
  parent_recurring_object: {
    id: 0,
    title: '',
    external_id: '',
    start_time: 's',
    end_time: 'e',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  },
  is_recurring: false,
  is_recurring_instance: false,
};

// ---------------------------------------------------------------------------
// Mock response helpers
// ---------------------------------------------------------------------------

function mockGroupsList() {
  vi.mocked(calendarGroupsList).mockResolvedValue({
    data: { count: 1, results: [GROUP] },
    response: new Response('{}', { status: 200 }),
  } as unknown as Awaited<ReturnType<typeof calendarGroupsList>>);
}

function mockAvailability(slots: CalendarGroupRangeAvailability['slots']) {
  const range: CalendarGroupRangeAvailability = {
    start_time: 's',
    end_time: 'e',
    slots,
  };
  vi.mocked(calendarGroupsAvailabilityCreate).mockResolvedValue({
    data: { count: 1, results: [range] },
    response: new Response('{}', { status: 200 }),
  } as unknown as Awaited<ReturnType<typeof calendarGroupsAvailabilityCreate>>);
}

function mockEventCreate() {
  vi.mocked(calendarGroupsEventsCreate).mockResolvedValue({
    data: CREATED_EVENT,
    response: new Response('{}', { status: 201 }),
  } as unknown as Awaited<ReturnType<typeof calendarGroupsEventsCreate>>);
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderFlow() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return render(<GroupBookingFlow open onOpenChange={vi.fn()} />, {
    wrapper: Wrapper,
  });
}

/** Pick the "Clinic" group from the Radix Select. */
async function selectGroup(user: ReturnType<typeof userEvent.setup>) {
  const trigger = await screen.findByRole('combobox', {
    name: /calendar group/i,
  });
  await user.click(trigger);
  const option = await screen.findByRole('option', { name: 'Clinic' });
  await user.click(option);
}

async function fillTitle(user: ReturnType<typeof userEvent.setup>) {
  const titleInput = screen.getByLabelText('Title');
  await user.clear(titleInput);
  await user.type(titleInput, 'Visit');
}

async function checkAvailability(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /check availability/i }));
}

const submitBtn = () => screen.getByTestId('group-book-submit');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GroupBookingFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGroupsList();
  });

  it('disables submit until availability is checked and slots are filled', async () => {
    const user = userEvent.setup();
    renderFlow();
    await selectGroup(user);
    await fillTitle(user);

    // Before any availability check, submit is disabled.
    expect(submitBtn()).toBeDisabled();
  });

  it('only free candidates are selectable; busy candidates are disabled', async () => {
    const user = userEvent.setup();
    // Nurse C (12) busy; Room 2 (21) busy.
    mockAvailability([
      { slot_id: 1, available_calendar_ids: [10, 11] },
      { slot_id: 2, available_calendar_ids: [20] },
    ]);
    renderFlow();
    await selectGroup(user);
    await fillTitle(user);
    await checkAvailability(user);

    const nurseSlot = await screen.findByTestId('slot-picker-1');
    // Free candidates enabled.
    expect(
      within(nurseSlot).getByRole('checkbox', { name: /nurse a/i })
    ).toBeEnabled();
    expect(
      within(nurseSlot).getByRole('checkbox', { name: /nurse b/i })
    ).toBeEnabled();
    // Busy candidate disabled.
    expect(
      within(nurseSlot).getByRole('checkbox', { name: /nurse c.*busy/i })
    ).toBeDisabled();
  });

  it('blocks submit when a slot has too FEW calendars selected', async () => {
    const user = userEvent.setup();
    mockAvailability([
      { slot_id: 1, available_calendar_ids: [10, 11, 12] },
      { slot_id: 2, available_calendar_ids: [20, 21] },
    ]);
    renderFlow();
    await selectGroup(user);
    await fillTitle(user);
    await checkAvailability(user);

    const nurseSlot = await screen.findByTestId('slot-picker-1');
    const roomSlot = screen.getByTestId('slot-picker-2');

    // Pick only ONE nurse (needs 2) but the required room.
    await user.click(
      within(nurseSlot).getByRole('checkbox', { name: /nurse a/i })
    );
    await user.click(
      within(roomSlot).getByRole('checkbox', { name: /room 1/i })
    );

    expect(submitBtn()).toBeDisabled();
  });

  it('caps a slot at its required count (cannot select too many → still submittable)', async () => {
    const user = userEvent.setup();
    mockAvailability([
      { slot_id: 1, available_calendar_ids: [10, 11, 12] },
      { slot_id: 2, available_calendar_ids: [20, 21] },
    ]);
    mockEventCreate();
    renderFlow();
    await selectGroup(user);
    await fillTitle(user);
    await checkAvailability(user);

    const roomSlot = await screen.findByTestId('slot-picker-2');
    // Room needs exactly 1. Selecting two should cap to the latest one.
    await user.click(
      within(roomSlot).getByRole('checkbox', { name: /room 1/i })
    );
    await user.click(
      within(roomSlot).getByRole('checkbox', { name: /room 2/i })
    );

    const nurseSlot = screen.getByTestId('slot-picker-1');
    await user.click(
      within(nurseSlot).getByRole('checkbox', { name: /nurse a/i })
    );
    await user.click(
      within(nurseSlot).getByRole('checkbox', { name: /nurse b/i })
    );

    // Room capped to 1 + nurses exactly 2 → submit enabled.
    await waitFor(() => expect(submitBtn()).toBeEnabled());
  });

  it('hard-blocks submit and warns when a slot is UNSATISFIABLE', async () => {
    const user = userEvent.setup();
    // Nurses needs 2 but only 1 free → unsatisfiable.
    mockAvailability([
      { slot_id: 1, available_calendar_ids: [10] },
      { slot_id: 2, available_calendar_ids: [20] },
    ]);
    renderFlow();
    await selectGroup(user);
    await fillTitle(user);
    await checkAvailability(user);

    // The unsatisfiable warning is shown.
    expect(
      await screen.findByTestId('unsatisfiable-alert')
    ).toBeInTheDocument();

    // Even selecting the only free nurse + the room cannot satisfy slot 1.
    const nurseSlot = screen.getByTestId('slot-picker-1');
    const roomSlot = screen.getByTestId('slot-picker-2');
    await user.click(
      within(nurseSlot).getByRole('checkbox', { name: /nurse a/i })
    );
    await user.click(
      within(roomSlot).getByRole('checkbox', { name: /room 1/i })
    );

    expect(submitBtn()).toBeDisabled();
  });

  it('success path: complete satisfiable selection books with correct slot assignments', async () => {
    const user = userEvent.setup();
    mockAvailability([
      { slot_id: 1, available_calendar_ids: [10, 11, 12] },
      { slot_id: 2, available_calendar_ids: [20, 21] },
    ]);
    mockEventCreate();
    renderFlow();
    await selectGroup(user);
    await fillTitle(user);
    await checkAvailability(user);

    const nurseSlot = await screen.findByTestId('slot-picker-1');
    const roomSlot = screen.getByTestId('slot-picker-2');
    await user.click(
      within(nurseSlot).getByRole('checkbox', { name: /nurse a/i })
    );
    await user.click(
      within(nurseSlot).getByRole('checkbox', { name: /nurse b/i })
    );
    await user.click(
      within(roomSlot).getByRole('checkbox', { name: /room 1/i })
    );

    await waitFor(() => expect(submitBtn()).toBeEnabled());
    await user.click(submitBtn());

    await waitFor(() =>
      expect(calendarGroupsEventsCreate).toHaveBeenCalledTimes(1)
    );
    const body = vi.mocked(calendarGroupsEventsCreate).mock.calls[0][0].body;
    expect(body.title).toBe('Visit');
    expect(body.slot_selections).toEqual([
      { slot_id: 1, calendar_ids: [10, 11] },
      { slot_id: 2, calendar_ids: [20] },
    ]);
  });
});
