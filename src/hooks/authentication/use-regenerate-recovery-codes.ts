import { postAuthByClientV1AccountAuthenticatorsRecoveryCodesMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AUTHENTICATORS_QUERY_KEY } from './use-authenticators';
import { RECOVERY_CODES_QUERY_KEY } from './use-recovery-codes';

/** Regenerate recovery codes — invalidates all previously issued ones. */
export function useRegenerateRecoveryCodes() {
  const queryClient = useQueryClient();
  const regenerateRecoveryCodesMutation = useMutation({
    ...postAuthByClientV1AccountAuthenticatorsRecoveryCodesMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECOVERY_CODES_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: AUTHENTICATORS_QUERY_KEY });
    },
  });

  const regenerateRecoveryCodes = async () =>
    regenerateRecoveryCodesMutation.mutateAsync({
      path: { client: 'app' },
    });

  return { regenerateRecoveryCodes, regenerateRecoveryCodesMutation };
}
