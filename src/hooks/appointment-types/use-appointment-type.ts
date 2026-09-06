/**
 * useAppointmentType — fetch a single appointment type by id.
 *
 * The API returns 404 identically whether the appointment type doesn't exist, belongs to
 * another organization, is out of the caller's scope, or the caller simply
 * isn't authorized (spec UC-8 — the non-disclosure requirement). This hook
 * surfaces exactly one bit, `isNotFound`, and nothing else, so no caller can
 * build UI that leaks which of those cases occurred.
 *
 * Uses a manual queryFn with throwOnError:false to inspect the response
 * status directly, mirroring use-current-organization.ts / use-default-
 * calendar.ts. The generated `appointmentTypesRetrieveOptions` uses
 * throwOnError:true and throws the parsed JSON body on error — which has no
 * status field — so it can't be used to distinguish 404 from any other
 * failure.
 */

import { appointmentTypesRetrieve } from '@/client';
import type { AppointmentType } from '@/client';
import { useQuery } from '@tanstack/react-query';

export const appointmentTypeQueryKey = (id: string) =>
  ['appointment-types', id] as const;

export type AppointmentTypeResult =
  | { status: 'ok'; appointmentType: AppointmentType }
  | { status: 'not_found'; appointmentType: null };

export function useAppointmentType(
  id: string,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const query = useQuery<AppointmentTypeResult>({
    queryKey: appointmentTypeQueryKey(id),
    enabled,
    queryFn: async ({ signal }) => {
      const { data, response } = await appointmentTypesRetrieve({
        path: { id },
        signal,
        throwOnError: false,
      });
      if (!response) {
        throw new Error('Failed to load appointment type (no response)');
      }
      if (response.status === 404) {
        // Identical for missing / other-org / out-of-scope / unauthorized —
        // see the doc comment above. Not an error state.
        return { status: 'not_found', appointmentType: null };
      }
      if (!response.ok || !data) {
        throw new Error(`Failed to load appointment type (${response.status})`);
      }
      return { status: 'ok', appointmentType: data };
    },
  });

  const result = query.data;

  return {
    appointmentType: result?.status === 'ok' ? result.appointmentType : null,
    isNotFound: result?.status === 'not_found',
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    query,
  };
}
