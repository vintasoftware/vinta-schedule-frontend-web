/**
 * canMintBookingLinkForCalendar / canMintBookingLinkForGroup — the UI
 * affordance for "can the current viewer generate a booking link for this
 * calendar / group". Mirrors the server's owner-or-org-admin rule: an org
 * admin (manage-members capability) may mint for any calendar or group;
 * another member only for a calendar they own or a group they participate
 * in (i.e. a group with at least one slot roster calendar they own).
 *
 * Kept pure and framework-free (no 'use client', no React import), following
 * the shape of `canEditCalendar`
 * (@/components/calendar-groups/group-permissions.ts) — directly unit
 * testable and importable from a Server Component.
 *
 * This is a UI affordance only, not authorization: the server enforces the
 * real rule on every mint/revoke request, and a hidden button here is not a
 * permission check. Hiding the action from an unauthorized viewer only
 * avoids offering a control that would 403.
 *
 * ---------------------------------------------------------------------
 * LOAD-BEARING ASSUMPTION (carried forward from group-permissions.ts — do
 * not remove this paragraph without re-reading it): `ownedCalendarIds` is
 * trusted here to contain *only* calendars the current member actually
 * owns, which in turn depends on the backend's `GET /calendar/?owner=me`
 * returning only the caller's own calendars. If that contract is ever
 * wrong, this predicate silently grants a member the ability to mint a
 * link against a calendar or group they do not own, and nothing in this
 * file (or its caller) can detect that from the frontend alone — the
 * frontend has no independent signal for calendar ownership to cross-check
 * against.
 * ---------------------------------------------------------------------
 */

import { PERMISSIONS } from '@/lib/permissions';

export interface CanMintBookingLinkForCalendarParams {
  permissions: readonly string[] | null;
  ownedCalendarIds: ReadonlySet<number>;
  calendarId: number;
}

/**
 * An unresolved permission set (`null`) mints nothing: this predicate fails
 * closed, matching `canEditCalendar`.
 */
export function canMintBookingLinkForCalendar({
  permissions,
  ownedCalendarIds,
  calendarId,
}: CanMintBookingLinkForCalendarParams): boolean {
  if (permissions === null) return false;
  if (permissions.includes(PERMISSIONS.manageMembers)) return true;
  return ownedCalendarIds.has(calendarId);
}

export interface CanMintBookingLinkForGroupParams {
  permissions: readonly string[] | null;
  ownedCalendarIds: ReadonlySet<number>;
  /**
   * Every calendar id appearing anywhere in the group's slot roster —
   * "participates in" is defined the same way `groupHasOwnedCalendar`
   * (@/components/calendar-groups/groups-table.tsx) defines member-visible
   * group membership: owning at least one calendar the group's slots use.
   */
  groupCalendarIds: readonly number[];
}

export function canMintBookingLinkForGroup({
  permissions,
  ownedCalendarIds,
  groupCalendarIds,
}: CanMintBookingLinkForGroupParams): boolean {
  if (permissions === null) return false;
  if (permissions.includes(PERMISSIONS.manageMembers)) return true;
  return groupCalendarIds.some((id) => ownedCalendarIds.has(id));
}
