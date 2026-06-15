import { useQuery } from '@tanstack/react-query';

import {
  notificationsListOptions,
  notificationsUnreadRetrieveOptions,
} from '@/client/@tanstack/react-query.gen';
import type { NotificationFilter, NotificationPage } from './types';

export interface UseNotificationsParams {
  filter: NotificationFilter;
  page: number;
  pageSize?: number;
}

/**
 * useNotifications — paginated notifications for the full-page list.
 *
 *   • 'all'    → GET /notifications/ (read + unread)
 *   • 'unread' → GET /notifications/unread/
 *
 * Both queries are always declared (no conditional hooks); `enabled` toggles
 * which one actually fetches for the active filter.
 */
export function useNotifications({
  filter,
  page,
  pageSize = 20,
}: UseNotificationsParams) {
  const usesUnreadEndpoint = filter === 'unread';

  const listQuery = useQuery({
    ...notificationsListOptions({ query: { page, page_size: pageSize } }),
    enabled: !usesUnreadEndpoint,
  });

  const unreadQuery = useQuery({
    ...notificationsUnreadRetrieveOptions({
      query: { page, page_size: pageSize },
    }),
    enabled: usesUnreadEndpoint,
  });

  const active = usesUnreadEndpoint ? unreadQuery : listQuery;
  const data = active.data as NotificationPage | undefined;

  return {
    notifications: data?.results ?? [],
    totalCount: data?.count ?? 0,
    pageSize,
    isLoading: active.isLoading,
    isError: active.isError,
    isFetching: active.isFetching,
    query: active,
  };
}
