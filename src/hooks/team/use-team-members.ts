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
// (disable/reactivate, phases 4/6) can invalidate all team-member queries
// regardless of pagination params by passing `queryKey` as a prefix filter:
//
//   queryClient.invalidateQueries({ queryKey: TEAM_MEMBERS_QUERY_KEY })
//
// This works because TanStack Query matches prefix sub-arrays.
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
    id: m.id,
    name:
      [m.user_first_name, m.user_last_name].filter(Boolean).join(' ') ||
      m.user_email,
    email: m.user_email,
    role: m.role,
    status: m.is_active ? 'active' : ('disabled' as TeamMemberStatus),
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
