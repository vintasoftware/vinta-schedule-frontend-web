import { deleteAuthByClientV1AccountAuthenticatorsTotpMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AUTHENTICATORS_QUERY_KEY } from './use-authenticators';
import { TOTP_QUERY_KEY } from './use-totp-config';

export function useDeactivateTotp() {
  const queryClient = useQueryClient();
  const deactivateTotpMutation = useMutation({
    ...deleteAuthByClientV1AccountAuthenticatorsTotpMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTHENTICATORS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: TOTP_QUERY_KEY });
    },
  });

  const deactivateTotp = async () =>
    deactivateTotpMutation.mutateAsync({
      path: { client: 'app' },
    });

  return { deactivateTotp, deactivateTotpMutation };
}
