import type { Notification } from '@/client';

// ---------------------------------------------------------------------------
// Notification pagination envelope.
//
// The notifications list/unread endpoints document their 200 body only as text
// in the OpenAPI schema (`{results, page, page_size, count}`), so codegen types
// the response as `unknown`. We hand-type the envelope here and reuse the
// generated `Notification` component schema for `results[]`.
// ---------------------------------------------------------------------------

export interface NotificationPage {
  results: Notification[];
  page: number;
  page_size: number;
  count: number;
}

export type NotificationFilter = 'all' | 'unread';

/** A notification is unread while its status is SENT (READ once acknowledged). */
export function isUnread(notification: Notification): boolean {
  return notification.status === 'SENT';
}

/**
 * Matches any TanStack Query whose key was produced by a notifications
 * operation — used to invalidate every notification list/badge after a
 * mark-read mutation regardless of its page/filter params.
 */
export function isNotificationQuery(queryKey: readonly unknown[]): boolean {
  const id = (queryKey?.[0] as { _id?: string } | undefined)?._id;
  return id === 'notificationsList' || id === 'notificationsUnreadRetrieve';
}
