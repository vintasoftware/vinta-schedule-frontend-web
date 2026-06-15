import { useMutation, useQueryClient } from '@tanstack/react-query';

import { notificationsMarkReadCreateMutation } from '@/client/@tanstack/react-query.gen';
import { isNotificationQuery } from './types';

/**
 * useMarkNotificationRead — mark a single notification read.
 *
 * Idempotent + ownership-scoped server-side: re-marking a READ item returns
 * 200, and an unknown/foreign id returns 404 (treated as "nothing to do").
 * Invalidates every notification list/badge query on success.
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    ...notificationsMarkReadCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => isNotificationQuery(q.queryKey),
      });
    },
  });

  const markRead = (id: string) => mutation.mutateAsync({ path: { id } });

  return { markRead, mutation };
}
