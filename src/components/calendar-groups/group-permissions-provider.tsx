'use client';

/**
 * Group detail page permission boundary — the context/provider/hook side of
 * `canEditCalendar` (group-permissions.ts). Split into its own 'use client'
 * file because this one creates a React context; the predicate itself stays
 * framework-free so it can be imported from anywhere, including a Server
 * Component.
 */

import * as React from 'react';
import { canEditCalendar } from './group-permissions';

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
