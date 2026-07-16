'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

import {
  Box,
  Center,
  Divider,
  HStack,
  Text,
  VStack,
} from 'vinta-schedule-design-system/layout';
import { Button } from 'vinta-schedule-design-system/ui/button';
import { List, ListItem } from 'vinta-schedule-design-system/ui/list';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'vinta-schedule-design-system/ui/popover';
import { ScrollArea } from 'vinta-schedule-design-system/ui/scroll-area';
import { Skeleton } from 'vinta-schedule-design-system/ui/skeleton';
import { useUnreadNotifications } from '@/hooks/notifications/use-unread-notifications';
import { useMarkNotificationRead } from '@/hooks/notifications/use-mark-notification-read';
import { NotificationListItem } from './notification-list-item';

// Delivery is poll-based (no server push) — refresh the unread badge on an
// interval and on window focus.
const POLL_INTERVAL_MS = 60_000;
const DROPDOWN_PAGE_SIZE = 10;

// TODO(ds-gap): no DS prop expresses `position: relative`+`flex-shrink` on a
// Button, a negative inset (`-top-0.5`), a 10px font size, or a between-items
// rule on <List> (the old `divide-y`). They ride as token-free inline values.
const TRIGGER_STYLE: React.CSSProperties = {
  position: 'relative',
  flexShrink: 0,
};
const BADGE_STYLE: React.CSSProperties = {
  top: '-0.125rem',
  right: '-0.125rem',
};
const BADGE_TEXT_STYLE: React.CSSProperties = { fontSize: '10px' };
const ROW_RULE_STYLE: React.CSSProperties = {
  borderTop: '1px solid var(--border)',
};

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
          style={TRIGGER_STYLE}
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : 'Notifications'
          }
        >
          <Bell />
          {unreadCount > 0 ? (
            <Center
              as='span'
              position='absolute'
              height={16}
              minWidth={16}
              px={1}
              radius='full'
              bg='primary'
              color='primary-foreground'
              style={BADGE_STYLE}
            >
              <Text
                as='span'
                weight='semibold'
                leading='none'
                style={BADGE_TEXT_STYLE}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </Center>
          ) : null}
        </Button>
      </PopoverTrigger>

      {/* className: PopoverContent is a shadcn atom — no width / padding props. */}
      <PopoverContent align='end' className='w-80 p-0'>
        <HStack justify='between' px={4} py={3}>
          <Text as='p' size='sm' weight='semibold'>
            Notifications
          </Text>
          {unreadCount > 0 ? (
            <Text size='xs' color='muted-foreground'>
              {unreadCount} unread
            </Text>
          ) : null}
        </HStack>
        <Divider />

        {/* className: ScrollArea is a shadcn atom — no max-height prop. */}
        <ScrollArea className='max-h-80'>
          {isLoading ? (
            <VStack gap={3} p={4}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height={48} width='full' />
              ))}
            </VStack>
          ) : notifications.length === 0 ? (
            <Box px={4} py={8}>
              <Text as='p' size='sm' color='muted-foreground' align='center'>
                You&rsquo;re all caught up.
              </Text>
            </Box>
          ) : (
            <List variant='plain' gap={0}>
              {notifications.map((n, i) => (
                <ListItem key={n.id} style={i > 0 ? ROW_RULE_STYLE : undefined}>
                  <NotificationListItem
                    notification={n}
                    onMarkRead={markRead}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </ScrollArea>

        <Divider />
        <VStack p={2}>
          <Button asChild variant='ghost'>
            <Link href='/notifications' onClick={() => setOpen(false)}>
              See all notifications
            </Link>
          </Button>
        </VStack>
      </PopoverContent>
    </Popover>
  );
}
