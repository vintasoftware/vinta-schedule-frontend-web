import type { OrganizationWritable } from '@/client';
import { organizationsCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CURRENT_ORGANIZATION_QUERY_KEY } from './use-current-organization';

/**
 * Creates the caller's own organization (onboarding escape hatch). On success
 * the user becomes ADMIN, so we refresh the gated/current-org state.
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const createOrganizationMutation = useMutation({
    ...organizationsCreateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CURRENT_ORGANIZATION_QUERY_KEY,
      });
    },
  });

  const createOrganization = async (body: OrganizationWritable) =>
    createOrganizationMutation.mutateAsync({ body });

  return { createOrganization, createOrganizationMutation };
}
