import type { Organization } from '@/client';
import { organizationsPartialUpdateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CURRENT_ORGANIZATION_QUERY_KEY,
  useCurrentOrganization,
} from './use-current-organization';
import { MY_ORGANIZATIONS_QUERY_KEY } from './use-my-organizations';

/**
 * PATCH /organizations/{id}/ with `{ slug }` from the branding console.
 * Invalidates current-org and mine/ so slug changes appear on membership
 * payloads (OrganizationBrief.slug) without a full reload.
 */
export function useUpdateOrganizationSlug() {
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  const updateOrganizationSlugMutation = useMutation({
    ...organizationsPartialUpdateMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: CURRENT_ORGANIZATION_QUERY_KEY,
      });
      queryClient.invalidateQueries({
        queryKey: MY_ORGANIZATIONS_QUERY_KEY,
      });
    },
  });

  const updateOrganizationSlug = async (
    slug: string | null
  ): Promise<Organization> => {
    if (!organization?.id) {
      throw new Error('Organization not loaded');
    }

    return updateOrganizationSlugMutation.mutateAsync({
      path: { id: String(organization.id) },
      // The generated writable narrowed `slug` to non-null (the backend refuses
      // a blank/cleared slug). The branding form still sends `null` to attempt a
      // clear and surfaces the resulting field error; cast at the boundary to
      // preserve that behavior rather than silently dropping the attempt.
      body: { slug } as { slug: string },
    });
  };

  return {
    updateOrganizationSlug,
    updateOrganizationSlugMutation,
  };
}
