/**
 * External-event change-request data hooks.
 *
 * Wraps the generated TanStack Query operations for /change-requests/:
 *   - useChangeRequests — paginated list, filtered by status (default pending).
 *   - useApproveChangeRequest — POST /change-requests/{id}/approve/.
 *   - useRejectChangeRequest — POST /change-requests/{id}/reject/.
 *
 * The list query key is exported as CHANGE_REQUESTS_QUERY_KEY (prefix only, no
 * variable args) so the mutations can invalidate every paginated / per-status
 * variant with a single prefix match.
 */

import {
  changeRequestsListOptions,
  changeRequestsListQueryKey,
  changeRequestsApproveCreateMutation,
  changeRequestsRejectCreateMutation,
} from '@/client/@tanstack/react-query.gen';
import type {
  ExternalEventChangeRequest,
  ExternalEventChangeRequestStatusEnum,
} from '@/client';
import type { DataTableQuery } from '@/components/data-table/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type {
  ExternalEventChangeRequest,
  ExternalEventChangeRequestStatusEnum,
};

// Built with no query args so the key omits the `query` field — invalidating
// it partial-matches every paginated / per-status list variant.
export const CHANGE_REQUESTS_QUERY_KEY = changeRequestsListQueryKey();

interface UseChangeRequestsOptions {
  query?: DataTableQuery;
  /** Status filter. Backend defaults to 'pending' when omitted. */
  status?: ExternalEventChangeRequestStatusEnum;
}

/**
 * useChangeRequests — fetch the paginated list of change requests.
 *
 * Eligibility is scoped server-side: admins see every request in the org,
 * members see only requests against events they attend.
 */
export function useChangeRequests(options?: UseChangeRequestsOptions) {
  const query = options?.query;
  const status = options?.status;

  const limit = query ? query.pageSize : undefined;
  const offset = query ? (query.page - 1) * query.pageSize : undefined;

  const changeRequestsQuery = useQuery(
    changeRequestsListOptions({ query: { limit, offset, status } })
  );

  const changeRequests: ExternalEventChangeRequest[] =
    changeRequestsQuery.data?.results ?? [];

  return {
    changeRequests,
    totalCount: changeRequestsQuery.data?.count ?? 0,
    isLoading: changeRequestsQuery.isLoading,
    isError: changeRequestsQuery.isError,
    error: changeRequestsQuery.error,
    changeRequestsQuery,
  };
}

/**
 * useApproveChangeRequest — apply the proposed change locally.
 */
export function useApproveChangeRequest() {
  const queryClient = useQueryClient();

  const approveMutation = useMutation({
    ...changeRequestsApproveCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANGE_REQUESTS_QUERY_KEY });
    },
  });

  const approveChangeRequest = async (
    id: number
  ): Promise<ExternalEventChangeRequest> =>
    approveMutation.mutateAsync({ path: { id: String(id) } });

  return { approveChangeRequest, approveMutation };
}

/**
 * useRejectChangeRequest — push the retained value back to the provider and
 * mark the request rejected.
 */
export function useRejectChangeRequest() {
  const queryClient = useQueryClient();

  const rejectMutation = useMutation({
    ...changeRequestsRejectCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHANGE_REQUESTS_QUERY_KEY });
    },
  });

  const rejectChangeRequest = async (
    id: number
  ): Promise<ExternalEventChangeRequest> =>
    rejectMutation.mutateAsync({ path: { id: String(id) } });

  return { rejectChangeRequest, rejectMutation };
}
