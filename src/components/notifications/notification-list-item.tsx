'use client';

import * as React from 'react';

import { DateTime } from '@/lib/datetime';
import type { Notification } from '@/client';
import { Box, Flex, Text } from 'vinta-schedule-design-system/layout';
import { Button } from 'vinta-schedule-design-system/ui/button';

/** Relative ("3 hours ago") rendering of an ISO timestamp; '' when absent. */
function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const dt = DateTime.fromISO(iso);
  return dt.isValid ? (dt.toRelative() ?? '') : '';
}

// TODO(ds-gap): none of these are expressible as DS props — a tinted surface
// (`bg-muted/40` → a 40% color-mix), a 6px/2px offset (off the 4px Space scale),
// `flex-shrink` / `overflow-wrap` on <Text>, and a zero-chrome text button.
const UNREAD_SURFACE_STYLE: React.CSSProperties = {
  backgroundColor: 'color-mix(in oklab, var(--muted) 40%, transparent)',
};
const DOT_STYLE: React.CSSProperties = { marginTop: '0.375rem' };
const TIME_STYLE: React.CSSProperties = { flexShrink: 0 };
const BODY_STYLE: React.CSSProperties = {
  marginTop: '0.125rem',
  overflowWrap: 'break-word',
};
const MARK_READ_STYLE: React.CSSProperties = {
  height: 'auto',
  padding: 0,
  marginTop: '0.25rem',
};

export interface NotificationListItemProps {
  notification: Notification;
  /** When provided and the item is unread, shows a "Mark as read" action. */
  onMarkRead?: (id: string) => void;
}

/**
 * NotificationListItem — one notification row, shared by the bell dropdown and
 * the full notifications page. Unread items are tinted and carry a leading dot.
 */
export function NotificationListItem({
  notification,
  onMarkRead,
}: NotificationListItemProps) {
  const unread = notification.status === 'SENT';
  const relative = formatRelative(notification.created);

  return (
    <Flex
      gap={3}
      px={4}
      py={3}
      style={unread ? UNREAD_SURFACE_STYLE : undefined}
    >
      <Box
        as='span'
        aria-hidden
        width={8}
        height={8}
        radius='full'
        shrink={0}
        bg={unread ? 'primary' : 'transparent'}
        style={DOT_STYLE}
      />
      <Box minWidth={0} grow={1}>
        <Flex align='baseline' justify='between' gap={2}>
          <Text
            as='p'
            size='sm'
            weight={unread ? 'semibold' : 'medium'}
            truncate
          >
            {notification.title}
          </Text>
          {relative ? (
            <Text
              as='time'
              size='xs'
              color='muted-foreground'
              style={TIME_STYLE}
            >
              {relative}
            </Text>
          ) : null}
        </Flex>
        {notification.body ? (
          <Text as='p' size='sm' color='muted-foreground' style={BODY_STYLE}>
            {notification.body}
          </Text>
        ) : null}
        {unread && onMarkRead ? (
          <Button
            type='button'
            variant='link'
            size='xs'
            onClick={() => onMarkRead(notification.id)}
            style={MARK_READ_STYLE}
          >
            Mark as read
          </Button>
        ) : null}
      </Box>
    </Flex>
  );
}
