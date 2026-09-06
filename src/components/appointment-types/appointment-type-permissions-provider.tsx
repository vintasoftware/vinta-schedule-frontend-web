'use client';

/**
 * Appointment Type detail page permission boundary — the context/provider/hook side of
 * `canEditCalendar` (appointment-type-permissions.ts). Split into its own 'use client'
 * file because this one creates a React context; the predicate itself stays
 * framework-free so it can be imported from anywhere, including a Server
 * Component.
 *
 * Also exposes `useCanMintBookingLinkForAppointmentType`: the appointment type detail page's mint
 * action needs the same `permissions` + `ownedCalendarIds` the roster rows
 * already read from this context, so it's a second predicate over the same
 * data rather than a second fetch.
 */

import * as React from 'react';
import { canEditCalendar } from './appointment-type-permissions';
import { canMintBookingLinkForAppointmentType } from '@/lib/booking-links/can-mint-booking-link';

interface AppointmentTypePermissionsContextValue {
  permissions: readonly string[] | null;
  ownedCalendarIds: ReadonlySet<number>;
}

// Default (no provider in the tree) is the fail-closed state: permissions null,
// no owned calendars — every row reads as read-only until a real provider
// supplies the resolved permissions and ownership set.
const AppointmentTypePermissionsContext =
  React.createContext<AppointmentTypePermissionsContextValue>({
    permissions: null,
    ownedCalendarIds: new Set(),
  });

export interface AppointmentTypePermissionsProviderProps extends AppointmentTypePermissionsContextValue {
  children: React.ReactNode;
}

export function AppointmentTypePermissionsProvider({
  permissions,
  ownedCalendarIds,
  children,
}: AppointmentTypePermissionsProviderProps) {
  const value = React.useMemo(
    () => ({ permissions, ownedCalendarIds }),
    [permissions, ownedCalendarIds]
  );
  return (
    <AppointmentTypePermissionsContext.Provider value={value}>
      {children}
    </AppointmentTypePermissionsContext.Provider>
  );
}

/** Whether the current viewer may edit `calendarId`'s appointment-type-scoped rows. */
export function useCanEditCalendar(calendarId: number): boolean {
  const { permissions, ownedCalendarIds } = React.useContext(
    AppointmentTypePermissionsContext
  );
  return canEditCalendar({ permissions, ownedCalendarIds, calendarId });
}

/**
 * Whether the current viewer may mint a booking link for this appointment type —
 * owner-or-org-admin, same as `useCanEditCalendar`, but evaluated against
 * every calendar in the appointment type's slot roster rather than a single calendar.
 */
export function useCanMintBookingLinkForAppointmentType(
  appointmentTypeCalendarIds: readonly number[]
): boolean {
  const { permissions, ownedCalendarIds } = React.useContext(
    AppointmentTypePermissionsContext
  );
  return canMintBookingLinkForAppointmentType({
    permissions,
    ownedCalendarIds,
    appointmentTypeCalendarIds,
  });
}
