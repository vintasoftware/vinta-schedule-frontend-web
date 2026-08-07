import type {
  OrganizationBranding,
  PatchedOrganizationBranding,
} from '@/client';
import { brandingPartialUpdateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BRANDING_QUERY_KEY, type BrandingResult } from './use-branding';

/**
 * Wraps PATCH /branding/ (partial update) for the acting org's branding.
 *
 * Used to persist a single field — e.g. `logo_url` right after the S3 upload
 * resolves — without resending the rest of the branding payload. PATCH only
 * updates an existing row (404s if branding isn't configured yet); use
 * useUpdateBranding's PUT to create one.
 *
 * On success, seeds the branding query cache directly with the response
 * (it's the same shape a GET returns) instead of invalidating and refetching.
 */
export function usePatchBranding() {
  const queryClient = useQueryClient();

  const patchBrandingMutation = useMutation({
    ...brandingPartialUpdateMutation(),
    onSuccess: (data: OrganizationBranding) => {
      const result: BrandingResult = { status: 'ok', branding: data };
      queryClient.setQueryData(BRANDING_QUERY_KEY, result);
    },
  });

  const patchBranding = async (body: PatchedOrganizationBranding) =>
    patchBrandingMutation.mutateAsync({ body });

  return { patchBranding, patchBrandingMutation };
}
