/**
 * canMintBookingLinkForCalendar / canMintBookingLinkForAppointmentType tests.
 *
 * Covers the full matrix called out in the phase spec: org admin with no
 * owned calendars, plain member with an owned calendar, plain member
 * without, appointment type participant, empty `permissions` array (a valid, normal
 * value), and `null` permissions (unresolved — must not grant).
 */

import { describe, it, expect } from 'vitest';
import {
  canMintBookingLinkForCalendar,
  canMintBookingLinkForAppointmentType,
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

describe('canMintBookingLinkForAppointmentType', () => {
  it('an org admin (manage-members) can mint for any appointment type, including one they participate in nothing of', () => {
    expect(
      canMintBookingLinkForAppointmentType({
        permissions: ['organizations.manage_members'],
        ownedCalendarIds: new Set(),
        appointmentTypeCalendarIds: [100, 101],
      })
    ).toBe(true);
  });

  it('an appointment type participant (owns a calendar in the appointment type roster) can mint', () => {
    expect(
      canMintBookingLinkForAppointmentType({
        permissions: [],
        ownedCalendarIds: new Set([101]),
        appointmentTypeCalendarIds: [100, 101],
      })
    ).toBe(true);
  });

  it('a member who owns nothing in the appointment type roster cannot mint', () => {
    expect(
      canMintBookingLinkForAppointmentType({
        permissions: [],
        ownedCalendarIds: new Set([999]),
        appointmentTypeCalendarIds: [100, 101],
      })
    ).toBe(false);
  });

  it('an empty permissions array is a valid, normal value — not a grant by itself', () => {
    expect(
      canMintBookingLinkForAppointmentType({
        permissions: [],
        ownedCalendarIds: new Set(),
        appointmentTypeCalendarIds: [],
      })
    ).toBe(false);
  });

  it('null (unresolved) permissions must not grant, even for a participated-in appointment type', () => {
    expect(
      canMintBookingLinkForAppointmentType({
        permissions: null,
        ownedCalendarIds: new Set([100]),
        appointmentTypeCalendarIds: [100],
      })
    ).toBe(false);
  });
});
