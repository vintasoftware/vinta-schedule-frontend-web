'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useUnreadNotifications } from '@/hooks/notifications/use-unread-notifications';
import { useMarkNotificationRead } from '@/hooks/notifications/use-mark-notification-read';
import { NotificationListItem } from './notification-list-item';

// Delivery is poll-based (no server push) — refresh the unread badge on an
// interval and on window focus.
const POLL_INTERVAL_MS = 60_000;
const DROPDOWN_PAGE_SIZE = 10;

/**
 * NotificationsBell — topbar bell with an unread-count badge. Opens a dropdown
 * listing the 10 most recent unread notifications, each markable inline, with a
 * footer link to the full notifications page.
 */
export function NotificationsBell() {
  const [open, setOpen] = React.useState(false);
  const { notifications, unreadCount, isLoading } = useUnreadNotifications({
    pageSize: DROPDOWN_PAGE_SIZE,
    refetchInterval: POLL_INTERVAL_MS,
  });
  const { markRead } = useMarkNotificationRead();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='relative shrink-0'
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
        >
          <Bell />
          {unreadCount > 0 ? (
            <span className='bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold'>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align='end' className='w-80 p-0'>
        <div className='flex items-center justify-between border-b px-4 py-3'>
          <p className='text-sm font-semibold'>Notifications</p>
          {unreadCount > 0 ? (
            <span className='text-muted-foreground text-xs'>
              {unreadCount} unread
            </span>
          ) : null}
        </div>

        <ScrollArea className='max-h-80'>
          {isLoading ? (
            <div className='space-y-3 p-4'>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className='h-12 w-full' />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <p className='text-muted-foreground px-4 py-8 text-center text-sm'>
              You&rsquo;re all caught up.
            </p>
          ) : (
            <ul className='divide-y'>
              {notifications.map((n) => (
                <li key={n.id}>
                  <NotificationListItem
                    notification={n}
                    onMarkRead={markRead}
                  />
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        <div className='border-t p-2'>
          <Button asChild variant='ghost' className='w-full justify-center'>
            <Link href='/notifications' onClick={() => setOpen(false)}>
              See all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
