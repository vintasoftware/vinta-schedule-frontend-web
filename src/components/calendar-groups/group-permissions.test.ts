/**
 * canEditCalendar tests.
 *
 * Covers:
 * - Admin edits any calendar, regardless of ownership.
 * - Member edits only calendars in their ownedCalendarIds set.
 * - Unknown / null role edits nothing (fail closed).
 */

import { describe, it, expect } from 'vitest';
import { canEditCalendar } from './group-permissions';
import type { RoleEnum } from '@/client';

describe('canEditCalendar', () => {
  it('admin can edit any calendar, owned or not', () => {
    expect(
      canEditCalendar({
        role: 'admin',
        ownedCalendarIds: new Set(),
        calendarId: 100,
      })
    ).toBe(true);

    expect(
      canEditCalendar({
        role: 'admin',
        ownedCalendarIds: new Set([999]),
        calendarId: 100,
      })
    ).toBe(true);
  });

  it('member can edit only a calendar in ownedCalendarIds', () => {
    const ownedCalendarIds = new Set([100]);

    expect(
      canEditCalendar({ role: 'member', ownedCalendarIds, calendarId: 100 })
    ).toBe(true);
    expect(
      canEditCalendar({ role: 'member', ownedCalendarIds, calendarId: 101 })
    ).toBe(false);
  });

  it('member with an empty ownedCalendarIds set edits nothing', () => {
    expect(
      canEditCalendar({
        role: 'member',
        ownedCalendarIds: new Set(),
        calendarId: 100,
      })
    ).toBe(false);
  });

  it('null role (not yet resolved) edits nothing, even if the id is owned', () => {
    expect(
      canEditCalendar({
        role: null,
        ownedCalendarIds: new Set([100]),
        calendarId: 100,
      })
    ).toBe(false);
  });

  it('an unrecognized role value edits nothing', () => {
    expect(
      canEditCalendar({
        role: 'not-a-real-role' as RoleEnum,
        ownedCalendarIds: new Set([100]),
        calendarId: 100,
      })
    ).toBe(false);
  });
});
