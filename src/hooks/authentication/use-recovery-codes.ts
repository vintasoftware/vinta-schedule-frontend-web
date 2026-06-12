import { getAuthByClientV1AccountAuthenticatorsRecoveryCodesOptions } from '@/auth-client/@tanstack/react-query.gen';
import { useQuery } from '@tanstack/react-query';

export const RECOVERY_CODES_QUERY_KEY =
  getAuthByClientV1AccountAuthenticatorsRecoveryCodesOptions({
    path: { client: 'app' },
  }).queryKey;

/**
 * Remaining (unused) recovery codes. Sensitive — the backend may demand
 * reauthentication, so keep `enabled` off until the user asks to view them.
 */
export function useRecoveryCodes({ enabled }: { enabled: boolean }) {
  const recoveryCodesQuery = useQuery({
    ...getAuthByClientV1AccountAuthenticatorsRecoveryCodesOptions({
      path: { client: 'app' },
    }),
    enabled,
    retry: false,
  });

  return {
    recoveryCodes: recoveryCodesQuery.data?.data,
    isLoading: recoveryCodesQuery.isLoading,
    isError: recoveryCodesQuery.isError,
    error: recoveryCodesQuery.error,
    recoveryCodesQuery,
  };
}
