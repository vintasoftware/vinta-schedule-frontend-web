import { organizationsCurrentRetrieve } from '@/client';
import type { CurrentMembership } from '@/client';
import { useQuery } from '@tanstack/react-query';

// Query key for the caller's current organization/membership. Mutations that
// change membership (create org, accept invite) should invalidate this key.
export const CURRENT_ORGANIZATION_QUERY_KEY = [
  'organizations',
  'current',
] as const;

export type CurrentOrganizationResult =
  | { status: 'onboarded'; membership: CurrentMembership }
  | { status: 'gated'; membership: null };

/**
 * Reads `GET /organizations/current`.
 *
 * The endpoint returns 200 + membership when the user is onboarded, and 404
 * when the user is authenticated but has no organization yet ("gated"). A 404
 * is a normal onboarding state, NOT an error — it resolves to `isGated`.
 */
export function useCurrentOrganization({
  enabled = true,
}: { enabled?: boolean } = {}) {
  const query = useQuery<CurrentOrganizationResult>({
    queryKey: CURRENT_ORGANIZATION_QUERY_KEY,
    enabled,
    queryFn: async ({ signal }) => {
      // Default throwOnError:false → inspect the response status ourselves.
      const { data, response } = await organizationsCurrentRetrieve({ signal });
      if (!response) {
        throw new Error('Failed to load current organization (no response)');
      }
      if (response.status === 404) {
        return { status: 'gated', membership: null };
      }
      if (!response.ok || !data) {
        throw new Error(
          `Failed to load current organization (${response.status})`
        );
      }
      return { status: 'onboarded', membership: data };
    },
  });

  const result = query.data;

  return {
    isGated: result?.status === 'gated',
    isOnboarded: result?.status === 'onboarded',
    membership: result?.status === 'onboarded' ? result.membership : null,
    role: result?.status === 'onboarded' ? result.membership.role : null,
    organization:
      result?.status === 'onboarded' ? result.membership.organization : null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    query,
  };
}
