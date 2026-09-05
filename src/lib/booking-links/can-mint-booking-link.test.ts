/**
 * canMintBookingLinkForCalendar / canMintBookingLinkForGroup tests.
 *
 * Covers the full matrix called out in the phase spec: org admin with no
 * owned calendars, plain member with an owned calendar, plain member
 * without, group participant, empty `permissions` array (a valid, normal
 * value), and `null` permissions (unresolved — must not grant).
 */

import { describe, it, expect } from 'vitest';
import {
  canMintBookingLinkForCalendar,
  canMintBookingLinkForGroup,
} from './can-mint-booking-link';

describe('canMintBookingLinkForCalendar', () => {
  it('an org admin (manage-members) can mint for any calendar, including one they own nothing of', () => {
    expect(
      canMintBookingLinkForCalendar({
        permissions: ['organizations.manage_members'],
        ownedCalendarIds: new Set(),
        calendarId: 100,
      })
    ).toBe(true);
  });

  it('a plain member with the calendar in their owned set can mint', () => {
    expect(
      canMintBookingLinkForCalendar({
        permissions: [],
        ownedCalendarIds: new Set([100]),
        calendarId: 100,
      })
    ).toBe(true);
  });

  it('a plain member without the calendar in their owned set cannot mint', () => {
    expect(
      canMintBookingLinkForCalendar({
        permissions: [],
        ownedCalendarIds: new Set([999]),
        calendarId: 100,
      })
    ).toBe(false);
  });

  it('an empty permissions array is a valid, normal value — not a grant by itself', () => {
    expect(
      canMintBookingLinkForCalendar({
        permissions: [],
        ownedCalendarIds: new Set(),
        calendarId: 100,
      })
    ).toBe(false);
  });

  it('null (unresolved) permissions must not grant, even if the id is owned', () => {
    expect(
      canMintBookingLinkForCalendar({
        permissions: null,
        ownedCalendarIds: new Set([100]),
        calendarId: 100,
      })
    ).toBe(false);
  });
});

describe('canMintBookingLinkForGroup', () => {
  it('an org admin (manage-members) can mint for any group, including one they participate in nothing of', () => {
    expect(
      canMintBookingLinkForGroup({
        permissions: ['organizations.manage_members'],
        ownedCalendarIds: new Set(),
        groupCalendarIds: [100, 101],
      })
    ).toBe(true);
  });

  it('a group participant (owns a calendar in the group roster) can mint', () => {
    expect(
      canMintBookingLinkForGroup({
        permissions: [],
        ownedCalendarIds: new Set([101]),
        groupCalendarIds: [100, 101],
      })
    ).toBe(true);
  });

  it('a member who owns nothing in the group roster cannot mint', () => {
    expect(
      canMintBookingLinkForGroup({
        permissions: [],
        ownedCalendarIds: new Set([999]),
        groupCalendarIds: [100, 101],
      })
    ).toBe(false);
  });

  it('an empty permissions array is a valid, normal value — not a grant by itself', () => {
    expect(
      canMintBookingLinkForGroup({
        permissions: [],
        ownedCalendarIds: new Set(),
        groupCalendarIds: [],
      })
    ).toBe(false);
  });

  it('null (unresolved) permissions must not grant, even for a participated-in group', () => {
    expect(
      canMintBookingLinkForGroup({
        permissions: null,
        ownedCalendarIds: new Set([100]),
        groupCalendarIds: [100],
      })
    ).toBe(false);
  });
});
