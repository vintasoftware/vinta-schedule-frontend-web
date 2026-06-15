'use client';

import * as React from 'react';

import { DateTime } from '@/lib/datetime';
import { cn } from '@/lib/utils/index';
import type { Notification } from '@/client';

/** Relative ("3 hours ago") rendering of an ISO timestamp; '' when absent. */
function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const dt = DateTime.fromISO(iso);
  return dt.isValid ? (dt.toRelative() ?? '') : '';
}

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
    <div className={cn('flex gap-3 px-4 py-3', unread && 'bg-muted/40')}>
      <span
        aria-hidden
        className={cn(
          'mt-1.5 size-2 shrink-0 rounded-full',
          unread ? 'bg-primary' : 'bg-transparent'
        )}
      />
      <div className='min-w-0 flex-1'>
        <div className='flex items-baseline justify-between gap-2'>
          <p
            className={cn(
              'truncate text-sm',
              unread ? 'font-semibold' : 'font-medium'
            )}
          >
            {notification.title}
          </p>
          {relative ? (
            <time className='text-muted-foreground shrink-0 text-xs'>
              {relative}
            </time>
          ) : null}
        </div>
        {notification.body ? (
          <p className='text-muted-foreground mt-0.5 text-sm break-words'>
            {notification.body}
          </p>
        ) : null}
        {unread && onMarkRead ? (
          <button
            type='button'
            onClick={() => onMarkRead(notification.id)}
            className='text-primary mt-1 text-xs font-medium hover:underline'
          >
            Mark as read
          </button>
        ) : null}
      </div>
    </div>
  );
}
