import { useQuery } from '@tanstack/react-query';

import { notificationsUnreadRetrieveOptions } from '@/client/@tanstack/react-query.gen';
import type { NotificationPage } from './types';

export interface UseUnreadNotificationsParams {
  page?: number;
  pageSize?: number;
  enabled?: boolean;
  /** Poll interval in ms for the unread badge (delivery is poll-based). */
  refetchInterval?: number | false;
}

/**
 * useUnreadNotifications — the user's unread (SENT) in-app notifications.
 *
 * `count` is the total unread count (server-side), so the bell badge can read
 * it directly without paging. The same query also returns the first page of
 * unread items for the bell dropdown.
 */
export function useUnreadNotifications({
  page = 1,
  pageSize = 10,
  enabled = true,
  refetchInterval,
}: UseUnreadNotificationsParams = {}) {
  const query = useQuery({
    ...notificationsUnreadRetrieveOptions({
      query: { page, page_size: pageSize },
    }),
    enabled,
    refetchInterval,
    refetchOnWindowFocus: true,
  });

  // The endpoint's 200 body is typed `unknown` by codegen (documented textually
  // in the schema); cast to the hand-typed envelope.
  const data = query.data as NotificationPage | undefined;

  return {
    notifications: data?.results ?? [],
    unreadCount: data?.count ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    query,
  };
}
