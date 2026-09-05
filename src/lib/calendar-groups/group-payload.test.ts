/**
 * group-payload tests.
 *
 * The behavior that matters here is what a group PATCH body must always carry.
 * `CalendarGroupSerializer` is only partial for `duration` and
 * `accepts_public_scheduling`; it refuses an update that omits `slots`, reads
 * `name` unguarded, and silently clears `description` when that is absent. So
 * these tests pin:
 *
 * - name / description / slots are present on every body, carried over from
 *   the group when the caller isn't changing them.
 * - duration and accepts_public_scheduling appear ONLY when passed, so a write
 *   about something else can't flip a group's public scheduling.
 * - a slot round-trips to a writable that reproduces it, with pool calendars
 *   staying in `pool_ids` rather than leaking into `calendar_ids`.
 */

import { describe, it, expect } from 'vitest';
import type { Calendar, CalendarGroup, CalendarPool } from '@/client';
import {
  buildGroupUpdateBody,
  buildPoolRosters,
  effectiveRoster,
  savedSlotsToWritable,
  splitSavedSlotRoster,
} from './group-payload';

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
 * A saved group whose only slot draws from the Nurses pool plus Carol picked
 * individually — its `calendars` is the flat union the API reports.
 */
const GROUP: CalendarGroup = {
  id: 42,
  name: 'Clinic',
  description: 'Walk-ins',
  public_booking_slug: 'grp-42',
  accepts_public_scheduling: false,
  duration: '00:30:00',
  slots: [
    {
      id: 100,
      name: 'Nurse',
      description: 'Ward staff',
      order: 0,
      required_count: 2,
      calendars: [CAL_A, CAL_B, CAL_C],
      pools: [POOL_NURSES],
    },
  ],
  created: '2024-01-01T00:00:00Z',
  modified: '2024-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Roster resolution
// ---------------------------------------------------------------------------

describe('effectiveRoster', () => {
  const rosters = buildPoolRosters([POOL_NURSES]);

  it('unions the individual picks with every attached pool roster', () => {
    expect(effectiveRoster([3], [7], rosters).sort()).toEqual([1, 2, 3]);
  });

  it('counts a calendar present in both sources once', () => {
    expect(effectiveRoster([1], [7], rosters).sort()).toEqual([1, 2]);
  });

  it('contributes nothing for a pool id it has no roster for', () => {
    expect(effectiveRoster([3], [999], rosters)).toEqual([3]);
  });
});

describe('splitSavedSlotRoster', () => {
  it('subtracts the attached pools rosters to recover the individual picks', () => {
    expect(splitSavedSlotRoster([CAL_A, CAL_B, CAL_C], [POOL_NURSES])).toEqual({
      calendar_ids: [3],
      pool_ids: [7],
    });
  });

  it('treats every calendar as individual when no pool is attached', () => {
    expect(splitSavedSlotRoster([CAL_A, CAL_C], [])).toEqual({
      calendar_ids: [1, 3],
      pool_ids: [],
    });
  });
});

describe('savedSlotsToWritable', () => {
  it('reproduces a slot without promoting its pool calendars to inline members', () => {
    expect(savedSlotsToWritable(GROUP)).toEqual([
      {
        name: 'Nurse',
        description: 'Ward staff',
        order: 0,
        required_count: 2,
        calendar_ids: [3],
        pool_ids: [7],
      },
    ]);
  });

  it('falls back to the array position for a slot with no explicit order', () => {
    const group: CalendarGroup = {
      ...GROUP,
      slots: [
        { ...GROUP.slots[0], order: undefined },
        {
          id: 101,
          name: 'Room',
          required_count: 1,
          calendars: [],
          pools: [],
          order: undefined,
        },
      ],
    };

    expect(savedSlotsToWritable(group).map((s) => s.order)).toEqual([0, 1]);
  });
});

// ---------------------------------------------------------------------------
// buildGroupUpdateBody
// ---------------------------------------------------------------------------

describe('buildGroupUpdateBody', () => {
  it('always carries name, description and the full slot list', () => {
    // The regression this pins: a caller changing only the public-scheduling
    // toggle used to send a two-key body, which the server refuses outright
    // because an absent `slots` would otherwise delete every slot.
    expect(
      buildGroupUpdateBody(GROUP, { accepts_public_scheduling: true })
    ).toEqual({
      name: 'Clinic',
      description: 'Walk-ins',
      slots: [
        {
          name: 'Nurse',
          description: 'Ward staff',
          order: 0,
          required_count: 2,
          calendar_ids: [3],
          pool_ids: [7],
        },
      ],
      accepts_public_scheduling: true,
    });
  });

  it('omits duration and accepts_public_scheduling when the caller does not pass them', () => {
    const body = buildGroupUpdateBody(GROUP, { name: 'Renamed' });

    // Both are tri-state server-side, so their absence is what keeps this
    // rename from also rewriting the group's public-scheduling state.
    expect('duration' in body).toBe(false);
    expect('accepts_public_scheduling' in body).toBe(false);
    expect(body.name).toBe('Renamed');
  });

  it('includes accepts_public_scheduling when it is being turned off', () => {
    // `false` is a real value, not an absent one — a plain truthiness check
    // here would silently drop the one change the caller asked for.
    const body = buildGroupUpdateBody(GROUP, {
      accepts_public_scheduling: false,
    });

    expect(body.accepts_public_scheduling).toBe(false);
  });

  it('sends an empty-string description for a group that has none', () => {
    // The server defaults a missing description to '', so this is the value it
    // would land on anyway — sending it explicitly keeps the body complete.
    const body = buildGroupUpdateBody({ ...GROUP, description: undefined });

    expect(body.description).toBe('');
  });

  it('takes caller-supplied slots over the group as read', () => {
    const slots = [
      {
        name: 'Nurse',
        description: '',
        order: 0,
        required_count: 1,
        calendar_ids: [1],
        pool_ids: [],
      },
    ];

    expect(buildGroupUpdateBody(GROUP, { slots }).slots).toEqual(slots);
  });
});
