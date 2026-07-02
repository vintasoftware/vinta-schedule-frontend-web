/**
 * Booking policy data hooks.
 *
 * Wraps the generated TanStack Query operations for /booking-policies/:
 *   - useBookingPolicies — paginated list.
 *   - useCreateBookingPolicy — create.
 *   - useUpdateBookingPolicy — partial update (PATCH).
 *   - useDeleteBookingPolicy — delete (idempotent 204 on the backend).
 *
 * A BookingPolicy carries the four booking guardrails (lead time, max horizon,
 * buffer-before, buffer-after — all in seconds) and targets exactly one of:
 *   - `calendar`             — a single calendar (personal, resource, or bundle).
 *   - `calendar_group`       — a calendar group.
 *   - `membership_user_id`   — an org member (their owning-membership layer).
 *   - `is_organization_default` — the org-wide fallback (at most one).
 *
 * Targets are immutable after creation; only the four rule fields are writable
 * on update, so `useUpdateBookingPolicy` sends a PatchedBookingPolicyWritable
 * containing only the rule fields.
 *
 * The list query key is exported as BOOKING_POLICIES_QUERY_KEY so the mutations
 * can invalidate it. The prefix form of the no-args key is not a guaranteed
 * prefix of the per-page keys, so the mutations invalidate via the predicate
 * form (matching the op `_id`) for robustness.
 */

import {
  bookingPoliciesListOptions,
  bookingPoliciesListQueryKey,
  bookingPoliciesCreateMutation,
  bookingPoliciesPartialUpdateMutation,
  bookingPoliciesDestroyMutation,
} from '@/client/@tanstack/react-query.gen';
import type {
  BookingPolicy,
  BookingPolicyWritable,
  PatchedBookingPolicyWritable,
} from '@/client';
import type { DataTableQuery } from '@/components/data-table/types';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type {
  BookingPolicy,
  BookingPolicyWritable,
  PatchedBookingPolicyWritable,
};

export const BOOKING_POLICIES_QUERY_KEY = bookingPoliciesListQueryKey();

// Invalidate every booking-policies list query (prefix + params variants). The
// no-args key returned by bookingPoliciesListQueryKey() may not be a true
// prefix of the per-params keys, so match on the generated op `_id` instead.
function invalidateBookingPolicies(
  queryClient: ReturnType<typeof useQueryClient>
) {
  return queryClient.invalidateQueries({
    predicate: (q) =>
      Array.isArray(q.queryKey) &&
      (q.queryKey[0] as { _id?: string })?._id === 'bookingPoliciesList',
  });
}

interface UseBookingPoliciesOptions {
  query?: DataTableQuery;
}

/**
 * useBookingPolicies — fetch the paginated list of booking policies.
 *
 * When called with a DataTableQuery, maps page/pageSize to limit/offset. When
 * called with no args, fetches the default page (used by the target-label
 * resolver and simple consumers). The endpoint is org-scoped by the backend and
 * supports only limit/offset (no search/ordering).
 */
export function useBookingPolicies(options?: UseBookingPoliciesOptions) {
  const query = options?.query;

  const limit = query ? query.pageSize : undefined;
  const offset = query ? (query.page - 1) * query.pageSize : undefined;

  const policiesQuery = useQuery(
    bookingPoliciesListOptions({ query: { limit, offset } })
  );

  const policies: BookingPolicy[] = policiesQuery.data?.results ?? [];

  return {
    policies,
    totalCount: policiesQuery.data?.count ?? 0,
    isLoading: policiesQuery.isLoading,
    isError: policiesQuery.isError,
    error: policiesQuery.error,
    policiesQuery,
  };
}

/**
 * useCreateBookingPolicy — create a booking policy.
 *
 * The body must set exactly one target field; the backend returns a 400 with a
 * named message when the target already has a policy or when zero/multiple
 * targets are supplied.
 */
export function useCreateBookingPolicy() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    ...bookingPoliciesCreateMutation(),
    onSuccess: () => invalidateBookingPolicies(queryClient),
  });

  const createBookingPolicy = async (
    body: BookingPolicyWritable
  ): Promise<BookingPolicy> => createMutation.mutateAsync({ body });

  return { createBookingPolicy, createMutation };
}

/**
 * useUpdateBookingPolicy — partially update a booking policy's rule fields.
 *
 * Only the four rule fields are writable; targets are immutable after creation.
 */
export function useUpdateBookingPolicy() {
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    ...bookingPoliciesPartialUpdateMutation(),
    onSuccess: () => invalidateBookingPolicies(queryClient),
  });

  const updateBookingPolicy = async (
    id: number,
    body: PatchedBookingPolicyWritable
  ): Promise<BookingPolicy> =>
    updateMutation.mutateAsync({ path: { id: String(id) }, body });

  return { updateBookingPolicy, updateMutation };
}

/**
 * useDeleteBookingPolicy — delete a booking policy.
 *
 * The backend destroy is idempotent (204 even when the policy no longer exists
 * for the bound org), so deleting falls the resolver through to the next layer.
 */
export function useDeleteBookingPolicy() {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    ...bookingPoliciesDestroyMutation(),
    onSuccess: () => invalidateBookingPolicies(queryClient),
  });

  const deleteBookingPolicy = async (id: number): Promise<void> => {
    await deleteMutation.mutateAsync({ path: { id: String(id) } });
  };

  return { deleteBookingPolicy, deleteMutation };
}
