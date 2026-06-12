import { postAuthByClientV1AccountPhoneMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ACCOUNT_PHONE_QUERY_KEY } from './use-account-phone';

/**
 * Add or change the account phone number. Triggers an SMS OTP (max 3
 * attempts); the pending `verify_phone` flow continues via the session token
 * the interceptor persisted from this response.
 */
export function useUpdatePhone() {
  const queryClient = useQueryClient();
  const updatePhoneMutation = useMutation({
    ...postAuthByClientV1AccountPhoneMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_PHONE_QUERY_KEY });
    },
  });

  const updatePhone = async (phone: string) =>
    updatePhoneMutation.mutateAsync({
      path: { client: 'app' },
      body: { phone },
    });

  return { updatePhone, updatePhoneMutation };
}
