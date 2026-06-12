import { postAuthByClientV1AccountAuthenticatorsTotpMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AUTHENTICATORS_QUERY_KEY } from './use-authenticators';
import { TOTP_QUERY_KEY } from './use-totp-config';

/** Activate TOTP by confirming the first code from the user's OTP app. */
export function useActivateTotp() {
  const queryClient = useQueryClient();
  const activateTotpMutation = useMutation({
    ...postAuthByClientV1AccountAuthenticatorsTotpMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTHENTICATORS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: TOTP_QUERY_KEY });
    },
  });

  const activateTotp = async (code: string) =>
    activateTotpMutation.mutateAsync({
      path: { client: 'app' },
      body: { code },
    });

  return { activateTotp, activateTotpMutation };
}
