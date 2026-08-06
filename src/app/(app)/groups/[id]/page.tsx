'use client';

import { use } from 'react';
import { Spinner } from 'vinta-schedule-design-system/ui/spinner';
import { VStack, Text } from 'vinta-schedule-design-system/layout';
import { useRequireRole } from '@/components/navigation/role-gate';
import { useCalendarGroup } from '@/hooks/calendar-groups/use-calendar-group';
import { GroupDetailView } from '@/components/calendar-groups/group-detail-view';
import { GroupNotFound } from '@/components/calendar-groups/group-not-found';

/**
 * GroupDetailPage — admin-only view of one calendar group: its slots, each
 * slot's roster, and a per-calendar summary of group-scoped configuration.
 *
 * Guarded by useRequireRole('admin'), exactly like /groups (Phase 2 replaces
 * this gate with ownership-based access for calendar owners).
 *
 * The API returns 404 identically whether the group doesn't exist, belongs
 * to another organization, is out of the caller's scope, or the caller isn't
 * authorized (spec UC-8). This page never redirects on that 404 — the URL
 * stays put so the browser back button still works — and renders the exact
 * same GroupNotFound output for all of those cases.
 */
export default function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { isAllowed } = useRequireRole('admin');
  const { group, isNotFound, isLoading, isError, error } = useCalendarGroup(id);

  if (!isAllowed) return null;

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

  return <GroupDetailView group={group} />;
}
