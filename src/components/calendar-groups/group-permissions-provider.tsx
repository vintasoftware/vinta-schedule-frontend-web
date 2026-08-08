'use client';

/**
 * Group detail page permission boundary — the context/provider/hook side of
 * `canEditCalendar` (group-permissions.ts). Split into its own 'use client'
 * file because this one creates a React context; the predicate itself stays
 * framework-free so it can be imported from anywhere, including a Server
 * Component.
 */

import * as React from 'react';
import type { RoleEnum } from '@/client';
import { canEditCalendar } from './group-permissions';

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
