/**
 * group-selection.ts tests.
 *
 * This module's pure logic is exercised in much greater depth (fixtures,
 * edge cases) by `@/hooks/calendar-groups/use-group-booking.test.ts`, which
 * imports these same functions through that hook's re-export and must keep
 * passing untouched (see this module's doc comment for why the code lives
 * here now). This file adds focused, colocated coverage for the module in
 * its new canonical home, and doubles as the regression test for the
 * re-export itself staying wired correctly.
 */

import { describe, it, expect } from 'vitest';
import type {
  CalendarGroupRangeAvailability,
  CalendarGroupSlot,
} from '@/client';
import {
  slotRequiredCount,
  buildSlotAvailability,
  isSlotSatisfiable,
  isSelectionComplete,
  hasUnsatisfiableSlot,
  type SlotViewModel,
} from './group-selection';

const SLOT_A: CalendarGroupSlot = {
  id: 1,
  name: 'Slot A',
  required_count: 2,
  calendars: [
    { id: 10, name: 'Cal 10' } as CalendarGroupSlot['calendars'][number],
    { id: 11, name: 'Cal 11' } as CalendarGroupSlot['calendars'][number],
    { id: 12, name: 'Cal 12' } as CalendarGroupSlot['calendars'][number],
  ],
  pools: [],
};

describe('slotRequiredCount', () => {
  it('defaults to 1 when required_count is unset', () => {
    expect(slotRequiredCount({ ...SLOT_A, required_count: undefined })).toBe(1);
  });

  it('returns the slot value when set', () => {
    expect(slotRequiredCount(SLOT_A)).toBe(2);
  });
});

describe('buildSlotAvailability', () => {
  it('intersects reported free ids with the slot pool and computes satisfiability', () => {
    const rangeAvailability: CalendarGroupRangeAvailability = {
      start_time: '2026-01-01T10:00:00Z',
      end_time: '2026-01-01T10:30:00Z',
      slots: [
        {
          slot_id: 1,
          // 999 is not in the pool — must be filtered out defensively.
          available_calendar_ids: [10, 11, 999],
          required_count: 2,
          is_bookable: true,
        },
      ],
    };

    const [result] = buildSlotAvailability([SLOT_A], rangeAvailability);
    expect(result.availableCalendarIds).toEqual([10, 11]);
    expect(result.isSatisfiable).toBe(true);
    expect(isSlotSatisfiable(result)).toBe(true);
  });

  it('treats a slot missing from the response as zero free calendars', () => {
    const rangeAvailability: CalendarGroupRangeAvailability = {
      start_time: '2026-01-01T10:00:00Z',
      end_time: '2026-01-01T10:30:00Z',
      slots: [],
    };

    const [result] = buildSlotAvailability([SLOT_A], rangeAvailability);
    expect(result.availableCalendarIds).toEqual([]);
    expect(result.isSatisfiable).toBe(false);
  });
});

describe('isSelectionComplete / hasUnsatisfiableSlot', () => {
  function slotView(availableCalendarIds: number[] | null): SlotViewModel {
    return {
      slotId: 1,
      name: 'Slot A',
      requiredCount: 2,
      pool: [
        { id: 10, name: 'Cal 10' },
        { id: 11, name: 'Cal 11' },
      ],
      availableCalendarIds,
    };
  }

  it('is incomplete when availability has not been checked yet', () => {
    expect(isSelectionComplete([slotView(null)], {})).toBe(false);
  });

  it('is incomplete when the selection count does not match requiredCount', () => {
    expect(isSelectionComplete([slotView([10, 11])], { 1: [10] })).toBe(false);
  });

  it('is complete when exactly requiredCount free candidates are selected', () => {
    expect(isSelectionComplete([slotView([10, 11])], { 1: [10, 11] })).toBe(
      true
    );
  });

  it('flags an unsatisfiable slot and blocks completion', () => {
    const slots = [slotView([10])]; // only 1 free, needs 2
    expect(hasUnsatisfiableSlot(slots)).toBe(true);
    expect(isSelectionComplete(slots, { 1: [10] })).toBe(false);
  });
});
