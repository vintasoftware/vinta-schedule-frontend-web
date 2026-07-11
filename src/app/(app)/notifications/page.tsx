'use client';

import * as React from 'react';

import { PageHeader } from '@vinta-schedule/design-system/layout/page-header';
import { Stack } from '@vinta-schedule/design-system/layout/stack';
import { NotificationsView } from '@/components/notifications/notifications-view';

/**
 * NotificationsPage — member view of all in-app notifications.
 *
 * Role-agnostic: any authenticated member sees their own notifications. The
 * list + read/unread/all filter live in NotificationsView, wrapped in Suspense
 * because it reads URL search params (filter + page).
 */
export default function NotificationsPage() {
  return (
    <Stack gap={6}>
      <PageHeader
        title='Notifications'
        description='Your in-app notifications.'
      />
      <React.Suspense>
        <NotificationsView />
      </React.Suspense>
    </Stack>
  );
}
