import type { PatchedOrganizationBranding } from '@/client';
import { brandingPartialUpdateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BRANDING_QUERY_KEY } from './use-branding';

/**
 * Wraps PATCH /branding/ (partial update) for the acting org's branding.
 *
 * Used to persist a single field — e.g. `logo_url` right after the S3 upload
 * resolves — without resending the rest of the branding payload. PATCH only
 * updates an existing row (404s if branding isn't configured yet); use
 * useUpdateBranding's PUT to create one.
 *
 * On success, invalidates the branding query so other consumers (e.g. the
 * sign-in interstitial) pick up the freshly stored logo.
 */
export function usePatchBranding() {
  const queryClient = useQueryClient();

  const patchBrandingMutation = useMutation({
    ...brandingPartialUpdateMutation(),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: BRANDING_QUERY_KEY,
      });
    },
  });

  const patchBranding = async (body: PatchedOrganizationBranding) =>
    patchBrandingMutation.mutateAsync({ body });

  return { patchBranding, patchBrandingMutation };
}
