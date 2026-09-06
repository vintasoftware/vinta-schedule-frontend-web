/**
 * useAppointmentTypes — list Appointment Types with pagination and search.
 *
 * Wraps `appointmentTypesList` (GET /appointment-types/). The backend scopes the
 * list to the caller's organization and supports pagination (limit/offset) and
 * search (name filter). Each appointment type embeds its `slots[]` (the nested
 * slot/required-count/candidate-pool model).
 *
 * When called with a DataTableQuery (Phase 28 — admin list), maps page/pageSize
 * to limit/offset and search to the name filter. When called with no args
 * (Phase 18 — member booking picker), fetches all appointment types without pagination.
 *
 * Exports APPOINTMENT_TYPES_QUERY_KEY so mutations (Phase 29 create-appointment type) can
 * invalidate the list.
 */

import {
  appointmentTypesListOptions,
  appointmentTypesListQueryKey,
} from '@/client/@tanstack/react-query.gen';
import type { AppointmentType } from '@/client';
import type { DataTableQuery } from '@/components/data-table/types';
import { useQuery } from '@tanstack/react-query';

export type { AppointmentType };

export const APPOINTMENT_TYPES_QUERY_KEY = appointmentTypesListQueryKey();

interface UseAppointmentTypesOptions {
  query?: DataTableQuery;
}

export function useAppointmentTypes(options?: UseAppointmentTypesOptions) {
  const query = options?.query;

  // Map DataTableQuery pagination to API limit/offset; search to name filter.
  const limit = query ? query.pageSize : undefined;
  const offset = query ? (query.page - 1) * query.pageSize : undefined;
  const name = query?.search || undefined;

  const appointmentTypesQuery = useQuery(
    appointmentTypesListOptions({ query: { limit, offset, name } })
  );

  const appointmentTypes: AppointmentType[] =
    appointmentTypesQuery.data?.results ?? [];

  return {
    appointmentTypes,
    totalCount: appointmentTypesQuery.data?.count ?? 0,
    isLoading: appointmentTypesQuery.isLoading,
    isError: appointmentTypesQuery.isError,
    error: appointmentTypesQuery.error,
    appointmentTypesQuery,
  };
}
