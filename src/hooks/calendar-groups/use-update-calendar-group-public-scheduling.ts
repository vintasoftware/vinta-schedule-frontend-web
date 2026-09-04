/**
 * useUpdateCalendarGroupPublicScheduling — PATCH the two public-scheduling
 * fields on a CalendarGroup: `accepts_public_scheduling` and `duration`.
 *
 * Thin wrapper over `calendarGroupsPartialUpdateMutation` (PATCH
 * /calendar-groups/{id}/). The body type is deliberately restricted to just
 * these two fields — `CalendarGroupSerializer` treats an omitted field as
 * "leave unchanged" but refuses an explicit `null` as a validation error
 * (the tri-state guiding decision in the public-scheduling-links plan), so
 * the caller (`PublicSchedulingSettings`) must only ever include a key here
 * when it is actively changing that field, never to "clear" it.
 *
 * On success, invalidates the single-group query
 * (`calendarGroupQueryKey`) so the detail view re-renders with the server's
 * new state rather than an optimistic guess.
 */

import type { PatchedCalendarGroupWritable } from '@/client';
import { calendarGroupsPartialUpdateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarGroupQueryKey } from './use-calendar-group';

export type PublicSchedulingPatch = Pick<
  PatchedCalendarGroupWritable,
  'accepts_public_scheduling' | 'duration'
>;

export function useUpdateCalendarGroupPublicScheduling(groupId: string) {
  const queryClient = useQueryClient();

  const updatePublicSchedulingMutation = useMutation({
    ...calendarGroupsPartialUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: calendarGroupQueryKey(groupId),
      });
    },
  });

  const updatePublicScheduling = async (body: PublicSchedulingPatch) =>
    updatePublicSchedulingMutation.mutateAsync({ path: { id: groupId }, body });

  return { updatePublicScheduling, updatePublicSchedulingMutation };
}
