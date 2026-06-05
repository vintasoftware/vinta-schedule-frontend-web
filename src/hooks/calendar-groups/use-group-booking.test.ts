/**
 * useGroupBooking tests.
 *
 * Covers the spike-critical group-booking invariants:
 * - buildSlotAvailability maps per-slot free ids and computes satisfiability
 *   (a slot with fewer free calendars than its required_count is unsatisfiable).
 * - isSelectionComplete: only FREE candidates count; an exact required_count is
 *   required; an unsatisfiable slot can never complete (drives submit-blocking).
 * - hasUnsatisfiableSlot flags any unsatisfiable slot (hard-block).
 * - fetchSlotAvailability calls calendarGroupsAvailabilityCreate with the range.
 * - bookGroupEvent calls calendarGroupsEventsCreate with the correct
 *   slot → calendar assignments.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/client/sdk.gen', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/client/sdk.gen')>();
  return {
    ...original,
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
  calendarGroupsBookableSlotsList,
  calendarGroupsAvailabilityCreate,
  calendarGroupsEventsCreate,
} from '@/client/sdk.gen';
import {
  useGroupBooking,
  buildSlotAvailability,
  isSelectionComplete,
  hasUnsatisfiableSlot,
  slotRequiredCount,
  type SlotViewModel,
} from './use-group-booking';
import type {
  CalendarGroupSlot,
  CalendarGroupRangeAvailability,
  CalendarEvent,
  Calendar,
} from '@/client';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeCalendar(id: number, name: string): Calendar {
  return {
    id,
    name,
    email: `cal${id}@example.com`,
    external_id: `ext-${id}`,
    provider: 'google',
    calendar_type: 'personal',
    capacity: null,
    is_active: true,
  } as Calendar;
}

/** Slot "Nurses" requires 2 from a pool of 3 calendars (10, 11, 12). */
const SLOT_NURSES: CalendarGroupSlot = {
  id: 1,
  name: 'Nurses',
  required_count: 2,
  calendars: [
    makeCalendar(10, 'Nurse A'),
    makeCalendar(11, 'Nurse B'),
    makeCalendar(12, 'Nurse C'),
  ],
};

/** Slot "Room" requires 1 from a pool of 2 calendars (20, 21). */
const SLOT_ROOM: CalendarGroupSlot = {
  id: 2,
  name: 'Room',
  required_count: 1,
  calendars: [makeCalendar(20, 'Room 1'), makeCalendar(21, 'Room 2')],
};

const FIXTURE_EVENT: CalendarEvent = {
  id: 500,
  title: 'Group Session',
  start_time: '2024-06-15T09:00:00-04:00',
  end_time: '2024-06-15T10:00:00-04:00',
  timezone: 'America/New_York',
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
  external_id: 'ext-500',
  external_attendances: [],
  attendances: [],
  resource_allocations: [],
  parent_recurring_object: {
    id: 0,
    title: '',
    external_id: '',
    start_time: '2024-01-01T00:00:00Z',
    end_time: '2024-01-01T00:00:00Z',
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
  },
  is_recurring: false,
  is_recurring_instance: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAvailabilityResponse(
  ranges: CalendarGroupRangeAvailability[]
): Awaited<ReturnType<typeof calendarGroupsAvailabilityCreate>> {
  const body = { count: ranges.length, results: ranges };
  return {
    data: body,
    response: new Response(JSON.stringify(body), { status: 200 }),
  } as unknown as Awaited<ReturnType<typeof calendarGroupsAvailabilityCreate>>;
}

function makeEventResponse(
  event: CalendarEvent
): Awaited<ReturnType<typeof calendarGroupsEventsCreate>> {
  return {
    data: event,
    response: new Response(JSON.stringify(event), { status: 201 }),
  } as unknown as Awaited<ReturnType<typeof calendarGroupsEventsCreate>>;
}

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

/** Build SlotViewModels for the two fixture slots with a given overlay. */
function viewModels(overlay: Record<number, number[] | null>): SlotViewModel[] {
  return [SLOT_NURSES, SLOT_ROOM].map((slot) => ({
    slotId: slot.id,
    name: slot.name,
    requiredCount: slotRequiredCount(slot),
    pool: slot.calendars.map((c) => ({ id: c.id, name: c.name })),
    availableCalendarIds: overlay[slot.id] ?? null,
  }));
}

// ---------------------------------------------------------------------------
// buildSlotAvailability
// ---------------------------------------------------------------------------

describe('buildSlotAvailability', () => {
  it('maps free calendar ids per slot and marks satisfiability', () => {
    const range: CalendarGroupRangeAvailability = {
      start_time: '2024-06-15T09:00:00-04:00',
      end_time: '2024-06-15T10:00:00-04:00',
      slots: [
        { slot_id: 1, available_calendar_ids: [10, 11] }, // 2 free, needs 2 → ok
        { slot_id: 2, available_calendar_ids: [20] }, // 1 free, needs 1 → ok
      ],
    };
    const result = buildSlotAvailability([SLOT_NURSES, SLOT_ROOM], range);

    expect(result[0]).toMatchObject({
      slotId: 1,
      availableCalendarIds: [10, 11],
      requiredCount: 2,
      isSatisfiable: true,
    });
    expect(result[1]).toMatchObject({
      slotId: 2,
      availableCalendarIds: [20],
      isSatisfiable: true,
    });
  });

  it('marks a slot unsatisfiable when free candidates < required_count', () => {
    const range: CalendarGroupRangeAvailability = {
      start_time: 's',
      end_time: 'e',
      slots: [
        { slot_id: 1, available_calendar_ids: [10] }, // only 1 free, needs 2
        { slot_id: 2, available_calendar_ids: [20] },
      ],
    };
    const result = buildSlotAvailability([SLOT_NURSES, SLOT_ROOM], range);
    expect(result[0].isSatisfiable).toBe(false);
  });

  it('treats a slot omitted from the response as zero free → unsatisfiable', () => {
    const range: CalendarGroupRangeAvailability = {
      start_time: 's',
      end_time: 'e',
      slots: [{ slot_id: 1, available_calendar_ids: [10, 11] }], // slot 2 missing
    };
    const result = buildSlotAvailability([SLOT_NURSES, SLOT_ROOM], range);
    expect(result[1].availableCalendarIds).toEqual([]);
    expect(result[1].isSatisfiable).toBe(false);
  });

  it('intersects reported ids with the slot pool (drops stray ids)', () => {
    const range: CalendarGroupRangeAvailability = {
      start_time: 's',
      end_time: 'e',
      slots: [{ slot_id: 2, available_calendar_ids: [20, 999] }], // 999 not in pool
    };
    const result = buildSlotAvailability([SLOT_ROOM], range);
    expect(result[0].availableCalendarIds).toEqual([20]);
  });
});

// ---------------------------------------------------------------------------
// isSelectionComplete — only-free + exact-count + satisfiability
// ---------------------------------------------------------------------------

describe('isSelectionComplete', () => {
  it('returns false before availability is known (overlay null)', () => {
    const slots = viewModels({ 1: null, 2: null });
    expect(isSelectionComplete(slots, {})).toBe(false);
  });

  it('returns true when every slot picks exactly required_count of free ids', () => {
    const slots = viewModels({ 1: [10, 11, 12], 2: [20, 21] });
    const selection = { 1: [10, 11], 2: [20] };
    expect(isSelectionComplete(slots, selection)).toBe(true);
  });

  it('returns false when a slot has too few selected (required count not met)', () => {
    const slots = viewModels({ 1: [10, 11, 12], 2: [20, 21] });
    const selection = { 1: [10], 2: [20] }; // slot 1 needs 2
    expect(isSelectionComplete(slots, selection)).toBe(false);
  });

  it('returns false when a slot has too many selected', () => {
    const slots = viewModels({ 1: [10, 11, 12], 2: [20, 21] });
    const selection = { 1: [10, 11], 2: [20, 21] }; // slot 2 needs 1
    expect(isSelectionComplete(slots, selection)).toBe(false);
  });

  it('returns false when a selected calendar is NOT in the free set', () => {
    const slots = viewModels({ 1: [10, 11], 2: [20] });
    const selection = { 1: [10, 12], 2: [20] }; // 12 is busy, not free
    expect(isSelectionComplete(slots, selection)).toBe(false);
  });

  it('returns false when any slot is unsatisfiable (free < required)', () => {
    const slots = viewModels({ 1: [10], 2: [20] }); // slot 1 only 1 free, needs 2
    const selection = { 1: [10], 2: [20] };
    expect(isSelectionComplete(slots, selection)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasUnsatisfiableSlot — hard-block flag
// ---------------------------------------------------------------------------

describe('hasUnsatisfiableSlot', () => {
  it('flags true when a checked slot lacks enough free candidates', () => {
    const slots = viewModels({ 1: [10], 2: [20] }); // slot 1 unsatisfiable
    expect(hasUnsatisfiableSlot(slots)).toBe(true);
  });

  it('flags false when all checked slots are satisfiable', () => {
    const slots = viewModels({ 1: [10, 11], 2: [20] });
    expect(hasUnsatisfiableSlot(slots)).toBe(false);
  });

  it('ignores unchecked slots (overlay null)', () => {
    const slots = viewModels({ 1: null, 2: null });
    expect(hasUnsatisfiableSlot(slots)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// useGroupBooking — fetchSlotAvailability + bookGroupEvent
// ---------------------------------------------------------------------------

describe('useGroupBooking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchSlotAvailability posts the chosen range to calendarGroupsAvailabilityCreate', async () => {
    vi.mocked(calendarGroupsAvailabilityCreate).mockResolvedValue(
      makeAvailabilityResponse([
        {
          start_time: '2024-06-15T09:00:00-04:00',
          end_time: '2024-06-15T10:00:00-04:00',
          slots: [{ slot_id: 1, available_calendar_ids: [10, 11] }],
        },
      ])
    );

    const { result } = renderHook(() => useGroupBooking(), {
      wrapper: wrapper(),
    });

    const range = await result.current.fetchSlotAvailability(
      7,
      '2024-06-15T09:00:00-04:00',
      '2024-06-15T10:00:00-04:00'
    );

    expect(calendarGroupsAvailabilityCreate).toHaveBeenCalledWith({
      path: { id: '7' },
      body: {
        ranges: [
          {
            start_time: '2024-06-15T09:00:00-04:00',
            end_time: '2024-06-15T10:00:00-04:00',
          },
        ],
      },
    });
    expect(range?.slots[0].available_calendar_ids).toEqual([10, 11]);
  });

  it('fetchBookableSlots passes duration + search window', async () => {
    vi.mocked(calendarGroupsBookableSlotsList).mockResolvedValue({
      data: { count: 0, results: [] },
      response: new Response('{}', { status: 200 }),
    } as unknown as Awaited<
      ReturnType<typeof calendarGroupsBookableSlotsList>
    >);

    const { result } = renderHook(() => useGroupBooking(), {
      wrapper: wrapper(),
    });

    await result.current.fetchBookableSlots({
      groupId: 7,
      durationSeconds: 3600,
      searchWindowStart: '2024-06-15T00:00:00-04:00',
      searchWindowEnd: '2024-06-15T23:59:59-04:00',
    });

    const callArg = vi.mocked(calendarGroupsBookableSlotsList).mock.calls[0][0];
    expect(callArg.path).toEqual({ id: '7' });
    expect(callArg.query?.duration_seconds).toBe(3600);
    expect(callArg.query?.search_window_start).toBe(
      '2024-06-15T00:00:00-04:00'
    );
    expect(callArg.query?.search_window_end).toBe('2024-06-15T23:59:59-04:00');
  });

  it('bookGroupEvent sends the correct slot → calendar assignments', async () => {
    vi.mocked(calendarGroupsEventsCreate).mockResolvedValue(
      makeEventResponse(FIXTURE_EVENT)
    );

    const { result } = renderHook(() => useGroupBooking(), {
      wrapper: wrapper(),
    });

    const event = await result.current.bookGroupEvent({
      groupId: 7,
      title: 'Group Session',
      startTime: '2024-06-15T09:00:00-04:00',
      endTime: '2024-06-15T10:00:00-04:00',
      timezone: 'America/New_York',
      slotSelections: [
        { slot_id: 1, calendar_ids: [10, 11] },
        { slot_id: 2, calendar_ids: [20] },
      ],
    });

    expect(calendarGroupsEventsCreate).toHaveBeenCalledWith({
      path: { id: '7' },
      body: {
        title: 'Group Session',
        start_time: '2024-06-15T09:00:00-04:00',
        end_time: '2024-06-15T10:00:00-04:00',
        timezone: 'America/New_York',
        slot_selections: [
          { slot_id: 1, calendar_ids: [10, 11] },
          { slot_id: 2, calendar_ids: [20] },
        ],
      },
    });
    expect(event.id).toBe(500);
  });

  it('bookGroupEvent throws when the backend rejects (no silent success)', async () => {
    vi.mocked(calendarGroupsEventsCreate).mockRejectedValue(
      new Error('Slot 1 became busy')
    );

    const { result } = renderHook(() => useGroupBooking(), {
      wrapper: wrapper(),
    });

    await expect(
      result.current.bookGroupEvent({
        groupId: 7,
        title: 'x',
        startTime: 's',
        endTime: 'e',
        timezone: 'UTC',
        slotSelections: [{ slot_id: 1, calendar_ids: [10, 11] }],
      })
    ).rejects.toThrow('Slot 1 became busy');
  });
});
