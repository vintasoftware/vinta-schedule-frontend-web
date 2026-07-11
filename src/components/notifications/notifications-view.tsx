'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { CheckCheck, ChevronLeft, ChevronRight } from 'lucide-react';

import { HStack } from '@vinta-schedule/design-system/layout/flex';
import { Stack } from '@vinta-schedule/design-system/layout/stack';
import { Text } from '@vinta-schedule/design-system/layout/text';
import { Button } from '@vinta-schedule/design-system/ui/button';
import { Skeleton } from '@vinta-schedule/design-system/ui/skeleton';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@vinta-schedule/design-system/ui/tabs';
import { useUrlState } from '@/hooks/use-url-state';
import { useNotifications } from '@/hooks/notifications/use-notifications';
import { useMarkNotificationRead } from '@/hooks/notifications/use-mark-notification-read';
import { useMarkAllNotificationsRead } from '@/hooks/notifications/use-mark-all-notifications-read';
import type { NotificationFilter } from '@/hooks/notifications/types';

import { NotificationListItem } from './notification-list-item';

const FILTERS: NotificationFilter[] = ['all', 'unread'];
const FILTER_LABELS: Record<NotificationFilter, string> = {
  all: 'All',
  unread: 'Unread',
};
const PAGE_SIZE = 20;

function isFilter(value: string): value is NotificationFilter {
  return (FILTERS as string[]).includes(value);
}

/**
 * NotificationsView — full notifications list with a read/unread/all filter and
 * pagination. Filter + page live in the URL (deep-linkable, survives refresh),
 * so this must render inside a <Suspense> boundary (useUrlState reads search
 * params).
 */
export function NotificationsView() {
  const [filterParam, setFilterParam] = useUrlState('filter', 'all');
  const [pageParam, setPageParam] = useUrlState('page', '1');

  const filter: NotificationFilter = isFilter(filterParam)
    ? filterParam
    : 'all';
  const page = Math.max(1, Number(pageParam) || 1);

  const { notifications, totalCount, pageSize, isLoading, isError } =
    useNotifications({ filter, page, pageSize: PAGE_SIZE });
  const { markRead } = useMarkNotificationRead();
  const { markAllRead, mutation: bulkMutation } = useMarkAllNotificationsRead();

  const hasPrev = page > 1;
  const hasNext = page * pageSize < totalCount;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const loadedUnreadIds = notifications
    .filter((n) => n.status === 'SENT')
    .map((n) => n.id);

  const changeFilter = (next: string) => {
    setFilterParam(next);
    setPageParam(null); // reset to page 1 when the filter changes
  };

  const handleMarkAll = async () => {
    if (loadedUnreadIds.length === 0) return;
    try {
      await markAllRead(loadedUnreadIds);
      toast.success('Notifications marked as read');
    } catch {
      toast.error('Could not mark notifications as read');
    }
  };

  return (
    <Stack gap={4}>
      <HStack justify='between' align='center' gap={3} wrap>
        <Tabs value={filter} onValueChange={changeFilter}>
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f} value={f}>
                {FILTER_LABELS[f]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Button
          variant='outline'
          size='sm'
          onClick={handleMarkAll}
          disabled={loadedUnreadIds.length === 0 || bulkMutation.isPending}
        >
          <CheckCheck className='mr-1 h-4 w-4' />
          Mark all as read
        </Button>
      </HStack>

      <div className='overflow-hidden rounded-md border'>
        {isLoading ? (
          <div className='space-y-3 p-4'>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className='h-12 w-full' />
            ))}
          </div>
        ) : isError ? (
          <Text
            size='sm'
            color='muted-foreground'
            className='px-4 py-8 text-center'
          >
            Could not load notifications. Please try again.
          </Text>
        ) : notifications.length === 0 ? (
          <Text
            size='sm'
            color='muted-foreground'
            className='px-4 py-12 text-center'
          >
            No notifications to show.
          </Text>
        ) : (
          <ul className='divide-y'>
            {notifications.map((n) => (
              <li key={n.id}>
                <NotificationListItem notification={n} onMarkRead={markRead} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalCount > pageSize ? (
        <HStack justify='between' align='center' gap={3}>
          <Text size='sm' color='muted-foreground'>
            Page {page} of {totalPages}
          </Text>
          <HStack gap={2}>
            <Button
              variant='outline'
              size='sm'
              disabled={!hasPrev}
              onClick={() => setPageParam(String(page - 1))}
            >
              <ChevronLeft className='mr-1 h-4 w-4' />
              Previous
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={!hasNext}
              onClick={() => setPageParam(String(page + 1))}
            >
              Next
              <ChevronRight className='ml-1 h-4 w-4' />
            </Button>
          </HStack>
        </HStack>
      ) : null}
    </Stack>
  );
}
