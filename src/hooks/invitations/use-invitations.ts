import {
  invitationsListOptions,
  invitationsListQueryKey,
} from '@/client/@tanstack/react-query.gen';
import { useQuery } from '@tanstack/react-query';
import type { DataTableQuery } from '@/components/data-table/types';

// ---------------------------------------------------------------------------
// Invitation
//
// View-level type derived from OrganizationInvitation. The hook always filters
// for is_accepted: false, so every row is pending — status is always 'pending'.
// The field is kept in the type for the column definition but is a constant
// value; accepted_at is not mapped to avoid a dead branch.
// ---------------------------------------------------------------------------

export type InvitationStatus = 'pending';

export interface Invitation {
  id: number;
  email: string;
  expiresAt: string;
  status: InvitationStatus;
}

// ---------------------------------------------------------------------------
// INVITATIONS_QUERY_KEY
//
// Base query key for `invitationsList`. Exported so mutations
// (resend/revoke, phases 4/5) can invalidate all invitations queries.
//
// CAVEAT: the no-args key returned by `invitationsListQueryKey()` may
// not be a true prefix of the per-page keys if the generated factory encodes
// the query params inside the key array. Prefer the predicate form for robust
// invalidation:
//
//   queryClient.invalidateQueries({
//     predicate: (q) =>
//       Array.isArray(q.queryKey) &&
//       (q.queryKey[0] as { _id?: string })?._id === 'invitationsList',
//   });
//
// The prefix form still works for the simplest cases where the factory emits a
// flat key beginning with the op identifier:
//
//   queryClient.invalidateQueries({ queryKey: INVITATIONS_QUERY_KEY })
// ---------------------------------------------------------------------------

export const INVITATIONS_QUERY_KEY = invitationsListQueryKey();

// ---------------------------------------------------------------------------
// useInvitations
//
// Wraps `invitationsList` (GET /invitations/), which returns a paginated list
// of org invitations. Always filters for pending invitations only (is_accepted: false)
// per the spec: "Pending = NOT accepted". Maps the DataTableQuery `page`/`pageSize`
// to the API's `limit`/`offset` style pagination. Wires the `search` field to the
// `email` query param for partial-match search on invitee email.
//
// Note: the `/invitations/` endpoint supports `email`, `is_accepted`, `is_expired`,
// `limit`, and `offset` query params. Sorting is not supported; DataTableQuery's
// `ordering` field is accepted for future compatibility but not forwarded to the API.
// ---------------------------------------------------------------------------

export function useInvitations(query: DataTableQuery) {
  const limit = query.pageSize;
  const offset = (query.page - 1) * query.pageSize;
  const email = query.search || undefined;

  const invitationsQuery = useQuery(
    invitationsListOptions({
      query: {
        limit,
        offset,
        is_accepted: false, // Filter for pending invitations only
        email, // Partial-match search on invitee email
      },
    })
  );

  const raw = invitationsQuery.data?.results ?? [];
  const totalCount = invitationsQuery.data?.count ?? 0;

  // Map API shape → Invitation view model.
  // The hook always passes is_accepted: false, so every row is pending.
  const invitations: Invitation[] = raw.map((inv) => ({
    id: inv.id,
    email: inv.email,
    expiresAt: inv.expires_at,
    status: 'pending',
  }));

  return {
    invitations,
    totalCount,
    isLoading: invitationsQuery.isLoading,
    isError: invitationsQuery.isError,
    error: invitationsQuery.error,
    invitationsQuery,
  };
}
