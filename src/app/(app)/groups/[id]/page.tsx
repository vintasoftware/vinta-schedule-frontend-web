'use client';

import { use } from 'react';
import { Spinner } from 'vinta-schedule-design-system/ui/spinner';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { VStack, Text } from 'vinta-schedule-design-system/layout';
import { useRole } from '@/components/navigation/role-gate';
import { useCalendarGroup } from '@/hooks/calendar-groups/use-calendar-group';
import { useOwnedCalendarIds } from '@/hooks/calendars/use-owned-calendar-ids';
import { GroupDetailView } from '@/components/calendar-groups/group-detail-view';
import { GroupNotFound } from '@/components/calendar-groups/group-not-found';
import { GroupPermissionsProvider } from '@/components/calendar-groups/group-permissions-provider';

/**
 * GroupDetailPage — one calendar group: its slots, each slot's roster, and
 * a per-calendar summary of group-scoped configuration.
 *
 * Phase 1 admin-gated this route with useRequireRole('admin'). Phase 2
 * drops that gate: the API itself decides who can see the group (returning
 * an identical 404 for missing / other-org / out-of-scope / unauthorized —
 * spec UC-8), and per-row editability is a separate, narrower question
 * answered by GroupPermissionsProvider below, not by a page-level redirect.
 * A member who reaches this page for a group they don't belong to gets the
 * same not-found treatment any other unreachable group gets.
 *
 * `enabled` on useCalendarGroup: previously gated on the admin-only
 * useRequireRole('isAllowed'), to avoid fetching the roster before a
 * non-admin's redirect fired. That redirect no longer exists, so the
 * gate is re-targeted at a different concern — waiting for `role` (and,
 * for members, `ownedCalendarIds`) to resolve before fetching or rendering
 * anything, so a row's editability is never computed against a
 * not-yet-loaded permission set and then flipped after the fact.
 */
export default function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const role = useRole();
  const isMember = role === 'member';
  const {
    ownedCalendarIds,
    isLoading: isOwnedCalendarsLoading,
    isError: isOwnedCalendarsError,
    refetch: refetchOwnedCalendars,
  } = useOwnedCalendarIds({ enabled: isMember });

  // Admins don't need ownedCalendarIds (canEditCalendar short-circuits on
  // role), so their readiness doesn't depend on that query settling.
  const permissionsReady =
    role !== null && (!isMember || !isOwnedCalendarsLoading);

  const { group, isNotFound, isLoading, isError, error } = useCalendarGroup(
    id,
    { enabled: permissionsReady }
  );

  if (!permissionsReady) {
    return (
      <VStack align='center' py={16}>
        <Spinner label='Loading calendar group' />
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
    return <GroupNotFound />;
  }

  if (isLoading) {
    return (
      <VStack align='center' py={16}>
        <Spinner label='Loading calendar group' />
      </VStack>
    );
  }

  if (isError || !group) {
    return (
      <VStack gap={2} py={6} align='center'>
        <Text color='destructive' weight='medium'>
          Failed to load calendar group.
        </Text>
        <Text color='muted-foreground' size='sm'>
          {error instanceof Error
            ? error.message
            : 'An unexpected error occurred.'}
        </Text>
      </VStack>
    );
  }

  return (
    <GroupPermissionsProvider role={role} ownedCalendarIds={ownedCalendarIds}>
      <GroupDetailView group={group} />
    </GroupPermissionsProvider>
  );
}
