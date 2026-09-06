/**
 * useUpdateAppointmentTypePublicScheduling — PATCH an AppointmentType's two
 * public-scheduling fields: `accepts_public_scheduling` and `duration`.
 *
 * Thin wrapper over `appointmentTypesPartialUpdateMutation` (PATCH
 * /appointment-types/{id}/). Those two fields ARE genuinely tri-state — omitted
 * means unchanged, an explicit `null` is a validation error — so the caller
 * still includes each one only when it is actively changing.
 *
 * What is NOT partial is the rest of the body. `AppointmentTypeSerializer`
 * replaces `slots` wholesale and has no unchanged sentinel for it, so it
 * refuses any partial update that omits `slots` (400) rather than reading the
 * absence as "delete every slot"; it also reads `name` unguarded and defaults
 * `description` to `""`, which silently clears it. A body carrying only the
 * two public-scheduling fields therefore never lands. Build the body with
 * `buildAppointmentTypeUpdateBody(appointment type, { … })`, which carries the rest over from the
 * appointment type as last read — the type below is the full patch shape for that reason,
 * not the two-field subset it used to be.
 *
 * On success, invalidates the single-appointment-type query
 * (`appointmentTypeQueryKey`) so the detail view re-renders with the server's
 * new state rather than an optimistic guess.
 */

import type { PatchedAppointmentTypeWritable } from '@/client';
import { appointmentTypesPartialUpdateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentTypeQueryKey } from './use-appointment-type';

export type PublicSchedulingPatch = PatchedAppointmentTypeWritable;

export function useUpdateAppointmentTypePublicScheduling(
  appointmentTypeId: string
) {
  const queryClient = useQueryClient();

  const updatePublicSchedulingMutation = useMutation({
    ...appointmentTypesPartialUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: appointmentTypeQueryKey(appointmentTypeId),
      });
    },
  });

  const updatePublicScheduling = async (body: PublicSchedulingPatch) =>
    updatePublicSchedulingMutation.mutateAsync({
      path: { id: appointmentTypeId },
      body,
    });

  return { updatePublicScheduling, updatePublicSchedulingMutation };
}
