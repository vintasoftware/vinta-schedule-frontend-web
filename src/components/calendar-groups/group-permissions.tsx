/**
 * Group detail page permission boundary.
 *
 * `canEditCalendar` is the single predicate every editor phase (3b onward)
 * consumes for "can the current viewer write to this calendar's
 * group-scoped configuration". It is kept pure, framework-free, and
 * directly unit-tested (group-permissions.test.ts) rather than re-derived
 * ad hoc inside component state — see the plan's Guiding Decisions and
 * Phase 2's "Permission widening is the main security risk" note.
 *
 * `GroupPermissionsProvider` / `useCanEditCalendar` exist so every roster
 * row asks the same question the same way, instead of each editor phase
 * re-reading role + ownedCalendarIds and recomputing the predicate itself.
 *
 * ---------------------------------------------------------------------
 * LOAD-BEARING ASSUMPTION (do not remove this paragraph without re-reading
 * it): `ownedCalendarIds` — supplied by the caller via
 * `@/hooks/calendars/use-owned-calendar-ids` — is trusted here to contain
 * *only* calendars the current member actually owns. That in turn depends
 * on the backend's `GET /calendar/?owner=me` returning only the caller's
 * own calendars. If that contract is ever wrong — the endpoint starts
 * returning calendars the caller does not own — `canEditCalendar` silently
 * grants a member write access to another person's roster row, and nothing
 * in this file (or its caller) can detect that from the frontend alone: the
 * frontend has no independent signal for calendar ownership to cross-check
 * against. This is recorded as Open Question 2 in
 * ai-plans/2026-08-05-CALENDAR_GROUP_SCOPED_AVAILABILITY_IMPLEMENTATION_PLAN.md.
 * `use-owned-calendar-ids.ts` mitigates this as much as is cheaply possible
 * by passing `owner: 'me'` explicitly (documented to scope by caller
 * identity, not by role) rather than relying on the endpoint's role-based
 * default — but that is a mitigation, not a proof.
 * ---------------------------------------------------------------------
 */

import * as React from 'react';
import type { RoleEnum } from '@/client';

export interface CanEditCalendarParams {
  role: RoleEnum | null;
  ownedCalendarIds: ReadonlySet<number>;
  calendarId: number;
}

/**
 * Admins may edit any calendar's group-scoped configuration. Members may
 * edit only calendars they own. Any other role value (including `null` —
 * not yet resolved) edits nothing: this predicate fails closed.
 */
export function canEditCalendar({
  role,
  ownedCalendarIds,
  calendarId,
}: CanEditCalendarParams): boolean {
  if (role === 'admin') return true;
  if (role === 'member') return ownedCalendarIds.has(calendarId);
  return false;
}

interface GroupPermissionsContextValue {
  role: RoleEnum | null;
  ownedCalendarIds: ReadonlySet<number>;
}

// Default (no provider in the tree) is the fail-closed state: role null,
// no owned calendars — every row reads as read-only until a real provider
// supplies the resolved role and ownership set.
const GroupPermissionsContext =
  React.createContext<GroupPermissionsContextValue>({
    role: null,
    ownedCalendarIds: new Set(),
  });

export interface GroupPermissionsProviderProps extends GroupPermissionsContextValue {
  children: React.ReactNode;
}

export function GroupPermissionsProvider({
  role,
  ownedCalendarIds,
  children,
}: GroupPermissionsProviderProps) {
  const value = React.useMemo(
    () => ({ role, ownedCalendarIds }),
    [role, ownedCalendarIds]
  );
  return (
    <GroupPermissionsContext.Provider value={value}>
      {children}
    </GroupPermissionsContext.Provider>
  );
}

/** Whether the current viewer may edit `calendarId`'s group-scoped rows. */
export function useCanEditCalendar(calendarId: number): boolean {
  const { role, ownedCalendarIds } = React.useContext(GroupPermissionsContext);
  return canEditCalendar({ role, ownedCalendarIds, calendarId });
}
