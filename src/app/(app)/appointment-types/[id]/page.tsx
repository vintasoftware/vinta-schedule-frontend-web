'use client';

import { use } from 'react';
import { Spinner } from 'vinta-schedule-design-system/ui/spinner';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { VStack, Text } from 'vinta-schedule-design-system/layout';
import {
  usePermissions,
  PERMISSIONS,
} from '@/components/navigation/permission-gate';
import { useAppointmentType } from '@/hooks/appointment-types/use-appointment-type';
import { useOwnedCalendarIds } from '@/hooks/calendars/use-owned-calendar-ids';
import { AppointmentTypeDetailView } from '@/components/appointment-types/appointment-type-detail-view';
import { AppointmentTypeNotFound } from '@/components/appointment-types/appointment-type-not-found';
import { AppointmentTypePermissionsProvider } from '@/components/appointment-types/appointment-type-permissions-provider';

import { getApiErrorMessage } from '@/lib/utils/api-errors';
/**
 * AppointmentTypeDetailPage — one appointment type: its slots, each slot's roster, and
 * a per-calendar summary of appointment-type-scoped configuration.
 *
 * Phase 1 admin-gated this route with useRequireRole('admin'). Phase 2
 * drops that gate: the API itself decides who can see the appointment type (returning
 * an identical 404 for missing / other-org / out-of-scope / unauthorized —
 * spec UC-8), and per-row editability is a separate, narrower question
 * answered by AppointmentTypePermissionsProvider below, not by a page-level redirect.
 * A member who reaches this page for an appointment type they don't belong to gets the
 * same not-found treatment any other unreachable appointment type gets.
 *
 * `enabled` on useAppointmentType: previously gated on the admin-only
 * useRequireRole('isAllowed'), to avoid fetching the roster before a
 * non-admin's redirect fired. That redirect no longer exists, so the
 * gate is re-targeted at a different concern — waiting for `role` (and,
 * for members, `ownedCalendarIds`) to resolve before fetching or rendering
 * anything, so a row's editability is never computed against a
 * not-yet-loaded permission set and then flipped after the fact.
 */
export default function AppointmentTypeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const permissions = usePermissions();
  // A "member" here is any resolved viewer who cannot manage members — they may
  // edit only calendars they own, so they need the ownership set. Admins
  // (manage_members) and the unresolved (null) state do not fetch it.
  const isMember =
    permissions !== null && !permissions.includes(PERMISSIONS.manageMembers);
  const {
    ownedCalendarIds,
    isLoading: isOwnedCalendarsLoading,
    isError: isOwnedCalendarsError,
    refetch: refetchOwnedCalendars,
  } = useOwnedCalendarIds({ enabled: isMember });

  // Admins don't need ownedCalendarIds (canEditCalendar short-circuits on
  // manage_members), so their readiness doesn't depend on that query settling.
  const permissionsReady =
    permissions !== null && (!isMember || !isOwnedCalendarsLoading);

  const { appointmentType, isNotFound, isLoading, isError, error } =
    useAppointmentType(id, { enabled: permissionsReady });

  if (!permissionsReady) {
    return (
      <VStack align='center' py={16}>
        <Spinner label='Loading appointment type' />
      </VStack>
    );
  }

  // A member whose ownership check failed must not silently fall back to
  // "owns nothing" — canEditCalendar would fail closed on an empty set and
  // every row (including ones the member actually owns) would render
  // read-only, indistinguishable from the true "owns nothing" case.
  if (isMember && isOwnedCalendarsError) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Couldn&apos;t check which calendars you own.
        </Text>
        <Text color='muted-foreground' size='sm'>
          Roster rows may show as read-only until this is retried.
        </Text>
        <Button size='sm' variant='outline' onClick={refetchOwnedCalendars}>
          Retry
        </Button>
      </VStack>
    );
  }

  if (isNotFound) {
    return <AppointmentTypeNotFound />;
  }

  if (isLoading) {
    return (
      <VStack align='center' py={16}>
        <Spinner label='Loading appointment type' />
      </VStack>
    );
  }

  if (isError || !appointmentType) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load appointment type.
        </Text>
        <Text color='muted-foreground' size='sm'>
          {getApiErrorMessage(error, 'An unexpected error occurred.')}
        </Text>
      </VStack>
    );
  }

  return (
    <AppointmentTypePermissionsProvider
      permissions={permissions}
      ownedCalendarIds={ownedCalendarIds}
    >
      <AppointmentTypeDetailView appointmentType={appointmentType} />
    </AppointmentTypePermissionsProvider>
  );
}
