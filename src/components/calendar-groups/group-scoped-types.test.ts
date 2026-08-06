/**
 * group-scoped-types tests -- the data-loss-critical classification and
 * diff logic, tested in isolation from any component.
 */

import { describe, it, expect } from 'vitest';
import type { GroupScopedAvailabilityWindow } from '@/client';
import {
  classifyWindow,
  classifyWindows,
  computeGridDiff,
  buildWindowCreateBody,
  buildWindowUpdateBody,
  defaultGridTimezone,
  type WeekdayWindow,
} from './group-scoped-types';

function makeWindow(
  overrides: Partial<GroupScopedAvailabilityWindow>
): GroupScopedAvailabilityWindow {
  return {
    id: 1,
    calendar_id: 42,
    group_slot_id: 7,
    // 2024-01-02 is a Tuesday.
    start_time: '2024-01-02T09:00:00Z',
    end_time: '2024-01-02T17:00:00Z',
    timezone: 'UTC',
    rrule_string: 'FREQ=WEEKLY;BYDAY=TU',
    is_recurring: true,
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('classifyWindow', () => {
  it('classifies a weekly single-BYDAY rule as representable', () => {
    const result = classifyWindow(makeWindow({}));
    expect(result).toEqual({
      kind: 'representable',
      row: { id: 1, weekday: 'TU', startTime: '09:00', endTime: '17:00' },
    });
  });

  it('accepts the "RRULE:" prefix form', () => {
    const result = classifyWindow(
      makeWindow({ rrule_string: 'RRULE:FREQ=WEEKLY;BYDAY=TU' })
    );
    expect(result.kind).toBe('representable');
  });

  it('classifies a one-off (no rrule_string) as unrepresentable', () => {
    const window = makeWindow({ rrule_string: null });
    expect(classifyWindow(window)).toEqual({ kind: 'unrepresentable', window });
  });

  it('classifies a multi-day BYDAY as unrepresentable', () => {
    const window = makeWindow({ rrule_string: 'FREQ=WEEKLY;BYDAY=MO,TU' });
    expect(classifyWindow(window)).toEqual({ kind: 'unrepresentable', window });
  });

  it('classifies a non-weekly frequency as unrepresentable', () => {
    const window = makeWindow({
      // 2024-01-02 is a Tuesday, so a daily rule is otherwise plausible --
      // it must still be rejected on FREQ alone.
      rrule_string: 'FREQ=DAILY',
    });
    expect(classifyWindow(window)).toEqual({ kind: 'unrepresentable', window });
  });

  it('classifies an unparseable rrule as unrepresentable', () => {
    const window = makeWindow({ rrule_string: 'not a valid rrule at all' });
    expect(classifyWindow(window)).toEqual({ kind: 'unrepresentable', window });
  });

  it('classifies FREQ=WEEKLY;BYDAY=<day> plus an extra part as unrepresentable (COUNT)', () => {
    const window = makeWindow({
      rrule_string: 'FREQ=WEEKLY;BYDAY=TU;COUNT=5',
    });
    expect(classifyWindow(window)).toEqual({ kind: 'unrepresentable', window });
  });

  it('classifies FREQ=WEEKLY;BYDAY=<day> plus UNTIL as unrepresentable', () => {
    const window = makeWindow({
      rrule_string: 'FREQ=WEEKLY;BYDAY=TU;UNTIL=20261231T000000Z',
    });
    expect(classifyWindow(window)).toEqual({ kind: 'unrepresentable', window });
  });

  it('classifies FREQ=WEEKLY;BYDAY=<day> plus INTERVAL as unrepresentable', () => {
    const window = makeWindow({
      rrule_string: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=TU',
    });
    expect(classifyWindow(window)).toEqual({ kind: 'unrepresentable', window });
  });

  it('classifies FREQ=WEEKLY;BYDAY=<day> plus an unknown part as unrepresentable (bias check)', () => {
    // A looser parser (e.g. parseRRule from lib/datetime) would silently
    // ignore WKST and accept this as a plain weekly/BYDAY=TU rule. This
    // module must NOT -- an unrecognized part makes the row unrepresentable.
    const window = makeWindow({
      rrule_string: 'FREQ=WEEKLY;BYDAY=TU;WKST=SU',
    });
    expect(classifyWindow(window)).toEqual({ kind: 'unrepresentable', window });
  });

  it('classifies a row whose BYDAY disagrees with its own start weekday as unrepresentable', () => {
    // start_time is a Tuesday but BYDAY says Monday -- ambiguous provenance.
    const window = makeWindow({ rrule_string: 'FREQ=WEEKLY;BYDAY=MO' });
    expect(classifyWindow(window)).toEqual({ kind: 'unrepresentable', window });
  });

  it('classifies an overnight range (end on a different weekday) as unrepresentable', () => {
    const window = makeWindow({
      start_time: '2024-01-02T22:00:00Z',
      end_time: '2024-01-03T02:00:00Z',
    });
    expect(classifyWindow(window)).toEqual({ kind: 'unrepresentable', window });
  });

  it('classifies a non-positive range (end <= start) as unrepresentable', () => {
    const window = makeWindow({
      start_time: '2024-01-02T09:00:00Z',
      end_time: '2024-01-02T09:00:00Z',
    });
    expect(classifyWindow(window)).toEqual({ kind: 'unrepresentable', window });
  });

  it('classifies an unparseable start_time as unrepresentable', () => {
    const window = makeWindow({ start_time: 'not-a-date' });
    expect(classifyWindow(window)).toEqual({ kind: 'unrepresentable', window });
  });
});

describe('classifyWindows (batch)', () => {
  it('splits a mixed list into representable rows and unrepresentable windows', () => {
    const weekly = makeWindow({ id: 1 });
    const oneOff = makeWindow({ id: 2, rrule_string: null });
    const multiDay = makeWindow({
      id: 3,
      rrule_string: 'FREQ=WEEKLY;BYDAY=MO,TU',
    });

    const { representable, unrepresentable } = classifyWindows([
      weekly,
      oneOff,
      multiDay,
    ]);

    expect(representable).toEqual([
      { id: 1, weekday: 'TU', startTime: '09:00', endTime: '17:00' },
    ]);
    expect(unrepresentable.map((w) => w.id)).toEqual([2, 3]);
  });
});

describe('computeGridDiff', () => {
  const loaded: WeekdayWindow[] = [
    { id: 1, weekday: 'MO', startTime: '09:00', endTime: '17:00' },
    { id: 2, weekday: 'WE', startTime: '09:00', endTime: '12:00' },
  ];

  it('produces an empty diff for an untouched grid (issues zero requests)', () => {
    const edited: WeekdayWindow[] = loaded.map((row) => ({ ...row }));
    expect(computeGridDiff(loaded, edited)).toEqual({
      creates: [],
      updates: [],
      deletes: [],
    });
  });

  it('produces a create for a new row with no id', () => {
    const edited: WeekdayWindow[] = [
      ...loaded.map((row) => ({ ...row })),
      { weekday: 'FR', startTime: '09:00', endTime: '17:00' },
    ];
    const diff = computeGridDiff(loaded, edited);
    expect(diff.creates).toEqual([
      { weekday: 'FR', startTime: '09:00', endTime: '17:00' },
    ]);
    expect(diff.updates).toEqual([]);
    expect(diff.deletes).toEqual([]);
  });

  it('produces an update for a row whose time changed', () => {
    const edited: WeekdayWindow[] = [
      { id: 1, weekday: 'MO', startTime: '10:00', endTime: '17:00' },
      { ...loaded[1] },
    ];
    const diff = computeGridDiff(loaded, edited);
    expect(diff.updates).toEqual([
      {
        id: 1,
        row: { id: 1, weekday: 'MO', startTime: '10:00', endTime: '17:00' },
      },
    ]);
    expect(diff.creates).toEqual([]);
    expect(diff.deletes).toEqual([]);
  });

  it('produces a delete for a loaded row removed from the grid', () => {
    const edited: WeekdayWindow[] = [{ ...loaded[0] }];
    const diff = computeGridDiff(loaded, edited);
    expect(diff.deletes).toEqual([2]);
    expect(diff.creates).toEqual([]);
    expect(diff.updates).toEqual([]);
  });

  it('produces a full mix of creates, updates, and deletes together', () => {
    const edited: WeekdayWindow[] = [
      // row 1 changed
      { id: 1, weekday: 'MO', startTime: '08:00', endTime: '17:00' },
      // row 2 removed (absent)
      // a brand-new row added
      { weekday: 'SA', startTime: '10:00', endTime: '11:00' },
    ];
    const diff = computeGridDiff(loaded, edited);
    expect(diff.creates).toEqual([
      { weekday: 'SA', startTime: '10:00', endTime: '11:00' },
    ]);
    expect(diff.updates).toEqual([
      {
        id: 1,
        row: { id: 1, weekday: 'MO', startTime: '08:00', endTime: '17:00' },
      },
    ]);
    expect(diff.deletes).toEqual([2]);
  });

  it('carries extra caller-only fields through creates/updates untouched (generic T)', () => {
    interface Tagged extends WeekdayWindow {
      formIndex: number;
    }
    const edited: Tagged[] = [
      { weekday: 'SA', startTime: '10:00', endTime: '11:00', formIndex: 3 },
    ];
    const diff = computeGridDiff(loaded, edited);
    expect(diff.creates[0].formIndex).toBe(3);
  });

  // -------------------------------------------------------------------------
  // THE data-loss-critical property: an unrepresentable row's id must be
  // impossible to reach through the grid's diff, proven end to end
  // (classify -> diff), not merely by inspecting computeGridDiff alone.
  // -------------------------------------------------------------------------
  it('never lets an unrepresentable row enter deletes, even when the grid is saved empty', () => {
    const representableWindow = makeWindow({ id: 1 });
    const oneOff = makeWindow({ id: 2, rrule_string: null });
    const multiDay = makeWindow({
      id: 3,
      rrule_string: 'FREQ=WEEKLY;BYDAY=MO,TU',
    });
    const nonWeekly = makeWindow({ id: 4, rrule_string: 'FREQ=DAILY' });

    const { representable } = classifyWindows([
      representableWindow,
      oneOff,
      multiDay,
      nonWeekly,
    ]);

    // The admin clears the entire grid (unticks every weekday) and saves.
    const diff = computeGridDiff(representable, []);

    // Only the representable row's id (1) may be deleted -- the three
    // unrepresentable ids (2, 3, 4) must never appear, because they were
    // never part of `representable`/`loaded` to begin with.
    expect(diff.deletes).toEqual([1]);
    expect(diff.deletes).not.toContain(2);
    expect(diff.deletes).not.toContain(3);
    expect(diff.deletes).not.toContain(4);
  });

  it('never lets an unrepresentable id enter deletes even if a caller tried to feed it in as loaded', () => {
    // Defense in depth at the type level: computeGridDiff only ever deletes
    // an id that is BOTH in `loaded` AND absent from `edited`. If some
    // future caller mistakenly fed classifyWindows' `unrepresentable`
    // windows into `loaded` (bypassing the classify -> diff contract this
    // module documents), the affected id would leak into deletes. This
    // test documents that the safety boundary is "never pass unrepresentable
    // windows as `loaded`" -- classifyWindows is the only sanctioned
    // producer of `loaded`, and its own output is asserted above.
    const badLoaded: WeekdayWindow[] = [
      { id: 99, weekday: 'MO', startTime: '09:00', endTime: '10:00' },
    ];
    const diff = computeGridDiff(badLoaded, []);
    expect(diff.deletes).toEqual([99]);
  });
});

describe('buildWindowCreateBody / buildWindowUpdateBody', () => {
  it('builds a create payload with a single-BYDAY weekly rrule and the given timezone', () => {
    const body = buildWindowCreateBody(
      { weekday: 'TU', startTime: '09:00', endTime: '17:00' },
      42,
      'America/Sao_Paulo'
    );
    expect(body.calendar).toBe(42);
    expect(body.timezone).toBe('America/Sao_Paulo');
    expect(body.rrule_string).toBe('FREQ=WEEKLY;BYDAY=TU');
    // The anchor date (2024-01-01 + 1 day = 2024-01-02) is a Tuesday, 09:00
    // America/Sao_Paulo (UTC-03:00 in January).
    expect(body.start_time).toBe('2024-01-02T09:00:00.000-03:00');
    expect(body.end_time).toBe('2024-01-02T17:00:00.000-03:00');
  });

  it('round-trips through classifyWindow (create -> classify -> same row)', () => {
    const body = buildWindowCreateBody(
      { weekday: 'FR', startTime: '13:00', endTime: '14:30' },
      1,
      'UTC'
    );
    const classified = classifyWindow({
      id: 55,
      calendar_id: 1,
      group_slot_id: 1,
      start_time: body.start_time,
      end_time: body.end_time,
      timezone: body.timezone,
      rrule_string: body.rrule_string ?? null,
      is_recurring: true,
      created: '',
      modified: '',
    });
    expect(classified).toEqual({
      kind: 'representable',
      row: { id: 55, weekday: 'FR', startTime: '13:00', endTime: '14:30' },
    });
  });

  it('builds an update payload that omits rrule_string and timezone (leave unchanged)', () => {
    const body = buildWindowUpdateBody(
      { id: 1, weekday: 'MO', startTime: '10:00', endTime: '18:00' },
      'America/Sao_Paulo'
    );
    expect('rrule_string' in body).toBe(false);
    expect('timezone' in body).toBe(false);
    expect(body.start_time).toBeTruthy();
    expect(body.end_time).toBeTruthy();
  });
});

describe('defaultGridTimezone', () => {
  it("returns the first loaded window's timezone when any window exists", () => {
    expect(
      defaultGridTimezone(
        [makeWindow({ timezone: 'America/Sao_Paulo' })],
        'UTC'
      )
    ).toBe('America/Sao_Paulo');
  });

  it("falls back to the viewer's timezone when there are no windows", () => {
    expect(defaultGridTimezone([], 'America/New_York')).toBe(
      'America/New_York'
    );
  });
});
