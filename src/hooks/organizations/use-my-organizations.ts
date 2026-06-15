import {
  organizationsMineListOptions,
  organizationsMineListQueryKey,
} from '@/client/@tanstack/react-query.gen';
import type { MyMembership } from '@/client';
import { useQuery } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// MY_ORGANIZATIONS_QUERY_KEY
//
// Base query key for `organizationsMineList`. Exported so mutations that
// change membership (create org, accept invite, phase 7) can invalidate it.
// ---------------------------------------------------------------------------

export const MY_ORGANIZATIONS_QUERY_KEY = organizationsMineListQueryKey();

// ---------------------------------------------------------------------------
// useMyOrganizations
//
// Wraps `organizationsMineList` (GET /organizations/mine/), which returns a
// bare array of the caller's active memberships. No pagination — returns all
// active orgs the user is a member of.
//
// The endpoint is not scoped by `X-Organization-Id` header; the response is
// always the full caller's membership list.
//
// Returns:
//   - memberships: Array<MyMembership> (may be empty when gated)
//   - isGated: true when memberships.length === 0 (user has no orgs yet)
//   - isMultiOrg: true when memberships.length > 1
//   - isLoading, isError, error: standard query states
//   - query: the raw TanStack Query object (for invalidation, etc.)
// ---------------------------------------------------------------------------

export function useMyOrganizations({ enabled = true } = {}) {
  const query = useQuery({
    ...organizationsMineListOptions({}),
    enabled,
  });

  const memberships: MyMembership[] = query.data ?? [];
  const isGated = memberships.length === 0;
  const isMultiOrg = memberships.length > 1;

  return {
    memberships,
    isGated,
    isMultiOrg,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    query,
  };
}
