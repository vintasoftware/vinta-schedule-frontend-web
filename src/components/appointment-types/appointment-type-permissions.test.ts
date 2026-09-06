/**
 * canEditCalendar tests.
 *
 * Covers:
 * - A viewer who can manage members edits any calendar, regardless of
 *   ownership.
 * - A member (no manage-members capability) edits only calendars in their
 *   ownedCalendarIds set.
 * - Unknown / null permissions edit nothing (fail closed).
 */

import { describe, it, expect } from 'vitest';
import { canEditCalendar } from './appointment-type-permissions';

describe('canEditCalendar', () => {
  it('a manage-members viewer can edit any calendar, owned or not', () => {
    expect(
      canEditCalendar({
        permissions: ['organizations.manage_members'],
        ownedCalendarIds: new Set(),
        calendarId: 100,
      })
    ).toBe(true);

    expect(
      canEditCalendar({
        permissions: ['organizations.manage_members'],
        ownedCalendarIds: new Set([999]),
        calendarId: 100,
      })
    ).toBe(true);
  });

  it('a member can edit only a calendar in ownedCalendarIds', () => {
    const ownedCalendarIds = new Set([100]);

    expect(
      canEditCalendar({ permissions: [], ownedCalendarIds, calendarId: 100 })
    ).toBe(true);
    expect(
      canEditCalendar({ permissions: [], ownedCalendarIds, calendarId: 101 })
    ).toBe(false);
  });

  it('a member with an empty ownedCalendarIds set edits nothing', () => {
    expect(
      canEditCalendar({
        permissions: [],
        ownedCalendarIds: new Set(),
        calendarId: 100,
      })
    ).toBe(false);
  });

  it('null permissions (not yet resolved) edit nothing, even if the id is owned', () => {
    expect(
      canEditCalendar({
        permissions: null,
        ownedCalendarIds: new Set([100]),
        calendarId: 100,
      })
    ).toBe(false);
  });

  it('a non-empty set without manage-members edits only owned calendars', () => {
    expect(
      canEditCalendar({
        permissions: ['some.other_capability'],
        ownedCalendarIds: new Set([100]),
        calendarId: 100,
      })
    ).toBe(true);
    expect(
      canEditCalendar({
        permissions: ['some.other_capability'],
        ownedCalendarIds: new Set([100]),
        calendarId: 101,
      })
    ).toBe(false);
  });
});
