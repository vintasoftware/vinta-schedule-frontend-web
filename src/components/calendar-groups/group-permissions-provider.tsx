'use client';

/**
 * Group detail page permission boundary — the context/provider/hook side of
 * `canEditCalendar` (group-permissions.ts). Split into its own 'use client'
 * file because this one creates a React context; the predicate itself stays
 * framework-free so it can be imported from anywhere, including a Server
 * Component.
 *
 * Also exposes `useCanMintBookingLinkForGroup`: the group detail page's mint
 * action needs the same `permissions` + `ownedCalendarIds` the roster rows
 * already read from this context, so it's a second predicate over the same
 * data rather than a second fetch.
 */

import * as React from 'react';
import { canEditCalendar } from './group-permissions';
import { canMintBookingLinkForGroup } from '@/lib/booking-links/can-mint-booking-link';

interface GroupPermissionsContextValue {
  permissions: readonly string[] | null;
  ownedCalendarIds: ReadonlySet<number>;
}

// Default (no provider in the tree) is the fail-closed state: permissions null,
// no owned calendars — every row reads as read-only until a real provider
// supplies the resolved permissions and ownership set.
const GroupPermissionsContext =
  React.createContext<GroupPermissionsContextValue>({
    permissions: null,
    ownedCalendarIds: new Set(),
  });

export interface GroupPermissionsProviderProps extends GroupPermissionsContextValue {
  children: React.ReactNode;
}

export function GroupPermissionsProvider({
  permissions,
  ownedCalendarIds,
  children,
}: GroupPermissionsProviderProps) {
  const value = React.useMemo(
    () => ({ permissions, ownedCalendarIds }),
    [permissions, ownedCalendarIds]
  );
  return (
    <GroupPermissionsContext.Provider value={value}>
      {children}
    </GroupPermissionsContext.Provider>
  );
}

/** Whether the current viewer may edit `calendarId`'s group-scoped rows. */
export function useCanEditCalendar(calendarId: number): boolean {
  const { permissions, ownedCalendarIds } = React.useContext(
    GroupPermissionsContext
  );
  return canEditCalendar({ permissions, ownedCalendarIds, calendarId });
}

/**
 * Whether the current viewer may mint a booking link for this group —
 * owner-or-org-admin, same as `useCanEditCalendar`, but evaluated against
 * every calendar in the group's slot roster rather than a single calendar.
 */
export function useCanMintBookingLinkForGroup(
  groupCalendarIds: readonly number[]
): boolean {
  const { permissions, ownedCalendarIds } = React.useContext(
    GroupPermissionsContext
  );
  return canMintBookingLinkForGroup({
    permissions,
    ownedCalendarIds,
    groupCalendarIds,
  });
}
