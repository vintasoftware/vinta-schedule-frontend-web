/**
 * useUpdateCalendarGroup — edit an existing Calendar Group.
 *
 * Wraps `calendarGroupsPartialUpdate` (PATCH /calendar-groups/{id}/). The
 * request is a PATCH, but `slots` is reconciled as a whole: the submitted list
 * is the group's new set of slots, and a slot missing from it is deleted.
 *
 * Two API behaviors callers have to know about:
 *
 *   - **Slots are matched by name**, not by id (`CalendarGroupSlotWritable` has
 *     no id). A slot sent under a new name is a delete plus a create, which
 *     drops its group-scoped availability windows, blocked time, and quota
 *     rules — and is refused while it has future bookings.
 *   - **`pool_ids` is omit-means-unchanged** for an existing slot but
 *     means-no-pools for a new one. Send it explicitly on every slot and the
 *     distinction stops mattering.
 *
 * Removing a calendar from a slot's roster always succeeds and leaves existing
 * bookings holding it untouched; removing a whole slot with future bookings is
 * still rejected, as `non_field_errors`, which `handleMutationError` routes to
 * the form's root message.
 *
 * Invalidates both the group list and the single-group detail query, since the
 * detail page reads through its own `['calendar-groups', id]` key.
 */

import type { PatchedCalendarGroupWritable, CalendarGroup } from '@/client';
import { calendarGroupsPartialUpdateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useUpdateCalendarGroup() {
  const queryClient = useQueryClient();

  const updateCalendarGroupMutation = useMutation({
    ...calendarGroupsPartialUpdateMutation(),
    onSuccess: () =>
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          ((q.queryKey[0] as { _id?: string })?._id === 'calendarGroupsList' ||
            q.queryKey[0] === 'calendar-groups'),
      }),
  });

  const updateCalendarGroup = async (
    id: number,
    body: PatchedCalendarGroupWritable
  ): Promise<CalendarGroup> =>
    updateCalendarGroupMutation.mutateAsync({ path: { id: String(id) }, body });

  return { updateCalendarGroup, updateCalendarGroupMutation };
}
