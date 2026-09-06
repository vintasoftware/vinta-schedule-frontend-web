/**
 * useCreateAppointmentType — create a new Appointment Type.
 *
 * Wraps `appointmentTypesCreate` (POST /appointment-types/). On success, invalidates
 * the appointment-types list via the predicate form so that any parameterised
 * list queries (paginated, searched) are also busted.
 *
 * Body shape (AppointmentTypeWritable):
 *   {
 *     name: string;          // required
 *     description?: string;  // optional
 *     slots: Array<{
 *       name: string;          // required
 *       description?: string;  // optional
 *       order?: number;        // optional — display order
 *       required_count?: number; // default 1 on backend
 *       calendar_ids: number[]; // IDs of candidate calendars for this slot
 *     }>;
 *   }
 *
 * Returns both an ergonomic `createAppointmentType` async fn and the raw mutation
 * object so callers can inspect `isPending`/`isError`.
 */

import type { AppointmentTypeWritable } from '@/client';
import { appointmentTypesCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useCreateAppointmentType() {
  const queryClient = useQueryClient();

  const createAppointmentTypeMutation = useMutation({
    ...appointmentTypesCreateMutation(),
    onSuccess: () => {
      // Invalidate all appointment-types list queries (prefix + params variants).
      // Use predicate form for robustness — the no-args key returned by
      // appointmentTypesListQueryKey() may not be a true prefix of the
      // per-params keys that hey-api encodes.
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          (q.queryKey[0] as { _id?: string })?._id === 'appointmentTypesList',
      });
    },
  });

  const createAppointmentType = async (body: AppointmentTypeWritable) =>
    createAppointmentTypeMutation.mutateAsync({ body });

  return { createAppointmentType, createAppointmentTypeMutation };
}
