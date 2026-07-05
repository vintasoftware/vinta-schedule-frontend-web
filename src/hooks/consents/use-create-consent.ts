import type { ConsentCreate, UserConsent } from '@/client';
import { consentsCreateMutation } from '@/client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';

/**
 * Hook for recording SMS consent before phone verification.
 *
 * Returns an async wrapper (`createConsent`) for ergonomic mutation calling,
 * plus the raw mutation object for accessing loading/error/success states.
 */
export function useCreateConsent() {
  const createConsentMutation = useMutation({
    ...consentsCreateMutation(),
  });

  const createConsent = async (body: ConsentCreate): Promise<UserConsent> => {
    return await createConsentMutation.mutateAsync({ body });
  };

  return {
    createConsent,
    createConsentMutation,
  };
}
