import { useMutation, useQueryClient } from '@tanstack/react-query';

import { notificationsMarkReadBulkCreateMutation } from '@/client/@tanstack/react-query.gen';
import { isNotificationQuery } from './types';

const BULK_LIMIT = 100;

/**
 * useMarkAllNotificationsRead — bulk mark-read.
 *
 * There is no server "mark everything" sweep, so callers pass the ids they want
 * cleared (e.g. the currently-loaded unread ids). Ids are sent in batches of
 * <=100 (the endpoint's per-call cap). Foreign/unknown ids are silently skipped
 * server-side. Queries are invalidated once after all batches resolve.
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  const mutation = useMutation(notificationsMarkReadBulkCreateMutation());

  const markAllRead = async (ids: Array<string | number>) => {
    const numericIds = ids
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));

    for (let i = 0; i < numericIds.length; i += BULK_LIMIT) {
      const batch = numericIds.slice(i, i + BULK_LIMIT);
      await mutation.mutateAsync({ body: { ids: batch } });
    }

    await queryClient.invalidateQueries({
      predicate: (q) => isNotificationQuery(q.queryKey),
    });
  };

  return { markAllRead, mutation };
}
