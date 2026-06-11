import { useQuery } from '@tanstack/react-query';
import { organizationMembersList } from '@/client/sdk.gen';

export interface OrgMemberOption {
  /** OrganizationMembership.id — passed as user_id for EventAttendanceWritable.
   *  NOTE: if the backend exposes a dedicated user_id on the membership serializer
   *  in the future, switch to that field. */
  id: number;
  name: string;
  email: string;
}

/**
 * Fetches org members matching `search` from the backend.
 * The /organization-members/ endpoint filters by first name, last name, or email (OR).
 * Returns an empty list when `search` is blank to avoid showing all members at once.
 */
export function useOrgMemberSearch(search: string) {
  const trimmed = search.trim();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['org-members-search', trimmed],
    queryFn: async () => {
      const res = await organizationMembersList({
        query: { search: trimmed, limit: 20 },
      });
      return res.data?.results ?? [];
    },
    enabled: trimmed.length > 0,
    staleTime: 30_000,
  });

  const members: OrgMemberOption[] = (data ?? [])
    .filter((m) => m.is_active)
    .map((m) => ({
      id: m.id,
      name:
        [m.user_first_name, m.user_last_name].filter(Boolean).join(' ') ||
        m.user_email,
      email: m.user_email,
    }));

  return { members, isLoading, isError };
}
