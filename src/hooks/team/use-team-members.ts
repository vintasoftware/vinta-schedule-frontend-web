import {
  organizationMembersListOptions,
  organizationMembersListQueryKey,
} from '@/client/@tanstack/react-query.gen';
import type { OrganizationMembership } from '@/client';
import { useQuery } from '@tanstack/react-query';
import type { DataTableQuery } from '@/components/data-table/types';

// ---------------------------------------------------------------------------
// TeamMember
//
// View-level type derived from OrganizationMembership. Composes first + last
// name into a single `name` field and maps `is_active` to a human-readable
// `status` for the datatable.
// ---------------------------------------------------------------------------

export type TeamMemberStatus = 'active' | 'disabled';

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: OrganizationMembership['role'];
  status: TeamMemberStatus;
}

// ---------------------------------------------------------------------------
// TEAM_MEMBERS_QUERY_KEY
//
// Base query key for `organizationMembersList`. Exported so mutations
// (disable/reactivate, phases 4/6) can invalidate all team-member queries.
//
// CAVEAT: the no-args key returned by `organizationMembersListQueryKey()` may
// not be a true prefix of the per-page keys if the generated factory encodes
// the query params inside the key array. Prefer the predicate form for robust
// invalidation:
//
//   queryClient.invalidateQueries({
//     predicate: (q) =>
//       Array.isArray(q.queryKey) &&
//       (q.queryKey[0] as { _id?: string })?._id === 'organizationMembersList',
//   });
//
// The prefix form still works for the simplest cases where the factory emits a
// flat key beginning with the op identifier:
//
//   queryClient.invalidateQueries({ queryKey: TEAM_MEMBERS_QUERY_KEY })
// ---------------------------------------------------------------------------

export const TEAM_MEMBERS_QUERY_KEY = organizationMembersListQueryKey();

// ---------------------------------------------------------------------------
// useTeamMembers
//
// Wraps `organizationMembersList` (GET /organization-members/), an admin-only
// endpoint that returns a paginated list of org members. Maps the DataTableQuery
// `page`/`pageSize` to the API's `limit`/`offset` style pagination.
//
// Note: the `/organization-members/` endpoint only supports `limit` and `offset`
// — it has no `search` or `ordering` query params. Those fields in DataTableQuery
// are accepted for future compatibility but are not forwarded to the API.
// ---------------------------------------------------------------------------

export function useTeamMembers(query: DataTableQuery) {
  const limit = query.pageSize;
  const offset = (query.page - 1) * query.pageSize;

  const membersQuery = useQuery(
    organizationMembersListOptions({ query: { limit, offset } })
  );

  const raw = membersQuery.data?.results ?? [];
  const totalCount = membersQuery.data?.count ?? 0;

  // Map API shape → TeamMember view model.
  const members: TeamMember[] = raw.map((m) => ({
    id: m.user_id,
    name:
      [m.user_first_name, m.user_last_name].filter(Boolean).join(' ') ||
      m.user_email,
    email: m.user_email,
    role: m.role,
    status: m.is_active ? 'active' : 'disabled',
  }));

  return {
    members,
    totalCount,
    isLoading: membersQuery.isLoading,
    isError: membersQuery.isError,
    error: membersQuery.error,
    membersQuery,
  };
}
