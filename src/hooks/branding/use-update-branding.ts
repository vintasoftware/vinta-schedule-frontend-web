import type { OrganizationBranding } from '@/client';
import { brandingUpdateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BRANDING_QUERY_KEY } from './use-branding';

/**
 * Wraps PUT /branding/ (create-or-replace) for the acting org's branding.
 *
 * Uses PUT rather than PATCH so that clearing optional fields works correctly:
 * a PUT with `logo_url: undefined` removes it server-side, while PATCH would
 * leave the old value. On success, invalidates the branding query so the form
 * prefills with the fresh saved values.
 */
export function useUpdateBranding() {
  const queryClient = useQueryClient();

  const updateBrandingMutation = useMutation({
    ...brandingUpdateMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: BRANDING_QUERY_KEY,
      });
    },
  });

  const updateBranding = async (body: OrganizationBranding) =>
    updateBrandingMutation.mutateAsync({ body });

  return { updateBranding, updateBrandingMutation };
}
