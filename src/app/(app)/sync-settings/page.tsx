'use client';

import * as React from 'react';
import { Stack } from '@/components/layout/stack';
import { PageHeader } from '@/components/layout/page-header';
import { RoomsSyncSettingsForm } from '@/components/sync/rooms-sync-settings-form';
import { TriggerRoomsSyncButton } from '@/components/sync/trigger-rooms-sync-button';
import { TriggerOrgCalendarSyncButton } from '@/components/sync/trigger-org-calendar-sync-button';
import { ServiceAccountCard } from '@/components/sync/service-account-card';
import { useRequireRole } from '@/components/navigation/role-gate';
import { Box } from '@/components/layout/box';
import { HStack, Text } from '@/components/layout';

/**
 * SyncSettingsPage — admin-only view for configuring sync settings.
 *
 * Guarded by useRequireRole('admin'): a member who somehow reaches this URL is
 * redirected to '/' (degrade-don't-loop rule — never redirect back into (app)).
 *
 * Renders:
 *  - The rooms-sync configuration form where admins can enable/disable
 *    rooms sync for the organization.
 *  - The Sync Rooms button to trigger an immediate rooms synchronization
 *    (fire-and-toast, Phase 34).
 *  - Service Account CRUD card for the org-level Google Calendar service account.
 *  - The Sync All Calendars button to trigger an org-wide calendar sync.
 */
export default function SyncSettingsPage() {
  // Gate: redirect non-admins out. The redirect fires in a useEffect, so
  // we also check isAllowed before rendering the form to avoid firing the
  // API call and rendering sensitive data before the redirect effect runs.
  const { isAllowed } = useRequireRole('admin');

  if (!isAllowed) return null;

  return (
    <Stack gap={6}>
      <PageHeader
        title='Sync settings'
        description='Configure synchronization for your organization.'
      />
      <RoomsSyncSettingsForm />

      {/* Service Account — configure Google Calendar service account for rooms sync */}
      <Box className='border-border border-t pt-6'>
        <Stack gap={3}>
          <Text weight='semibold'>Service account</Text>
          <Text size='sm' color='muted-foreground'>
            The org-level Google Calendar service account used for rooms sync.
          </Text>
          <ServiceAccountCard />
        </Stack>
      </Box>

      {/* Sync triggers — fire-and-toast actions */}
      <Box className='border-border border-t pt-6'>
        <Stack gap={3}>
          <Text weight='semibold'>Manual sync</Text>
          <Text size='sm' color='muted-foreground'>
            Trigger an immediate synchronization. These actions are asynchronous
            — you will see a confirmation toast when the sync has been enqueued.
          </Text>
          <HStack gap={3}>
            <TriggerRoomsSyncButton />
            <TriggerOrgCalendarSyncButton />
          </HStack>
        </Stack>
      </Box>
    </Stack>
  );
}
