/**
 * useUpdateAppointmentType — edit an existing Appointment Type.
 *
 * Wraps `appointmentTypesPartialUpdate` (PATCH /appointment-types/{id}/). The
 * request is a PATCH, but `slots` is reconciled as a whole: the submitted list
 * is the appointment type's new set of slots, and a slot missing from it is deleted.
 *
 * Two API behaviors callers have to know about:
 *
 *   - **Slots are matched by name**, not by id (`AppointmentTypeSlotWritable` has
 *     no id). A slot sent under a new name is a delete plus a create, which
 *     drops its appointment-type-scoped availability windows, blocked time, and quota
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
 * Invalidates both the appointment type list and the single-appointment-type detail query, since the
 * detail page reads through its own `['appointment-types', id]` key.
 */

import type { PatchedAppointmentTypeWritable, AppointmentType } from '@/client';
import { appointmentTypesPartialUpdateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useUpdateAppointmentType() {
  const queryClient = useQueryClient();

  const updateAppointmentTypeMutation = useMutation({
    ...appointmentTypesPartialUpdateMutation(),
    onSuccess: () =>
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          ((q.queryKey[0] as { _id?: string })?._id ===
            'appointmentTypesList' ||
            q.queryKey[0] === 'appointment-types'),
      }),
  });

  const updateAppointmentType = async (
    id: number,
    body: PatchedAppointmentTypeWritable
  ): Promise<AppointmentType> =>
    updateAppointmentTypeMutation.mutateAsync({
      path: { id: String(id) },
      body,
    });

  return { updateAppointmentType, updateAppointmentTypeMutation };
}
