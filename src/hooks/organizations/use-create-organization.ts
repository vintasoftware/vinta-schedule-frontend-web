import type { Organization, OrganizationWritable } from '@/client';
import { organizationsCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CURRENT_ORGANIZATION_QUERY_KEY } from './use-current-organization';
import { MY_ORGANIZATIONS_QUERY_KEY } from './use-my-organizations';

/**
 * Creates the caller's own organization (onboarding + switcher). On success
 * the user becomes ADMIN, so we refresh both the current-org state (gated
 * check) AND the mine/ list (switcher + multi-org bootstrap). The returned
 * `createOrganization` resolves to the newly created Organization so callers
 * can immediately call setActive(String(org.id)).
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const createOrganizationMutation = useMutation({
    ...organizationsCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CURRENT_ORGANIZATION_QUERY_KEY,
      });
      queryClient.invalidateQueries({
        queryKey: MY_ORGANIZATIONS_QUERY_KEY,
      });
    },
  });

  const createOrganization = async (
    body: OrganizationWritable
  ): Promise<Organization> => createOrganizationMutation.mutateAsync({ body });

  return { createOrganization, createOrganizationMutation };
}
