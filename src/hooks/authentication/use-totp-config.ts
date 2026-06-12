import { getAuthByClientV1AccountAuthenticatorsTotpOptions } from '@/auth-client/@tanstack/react-query.gen';
import { useQuery } from '@tanstack/react-query';

export const TOTP_QUERY_KEY = getAuthByClientV1AccountAuthenticatorsTotpOptions(
  {
    path: { client: 'app' },
  }
).queryKey;

export interface TotpSetupData {
  secret: string;
  totp_url: string;
}

function extractSetupData(error: unknown): TotpSetupData | undefined {
  // allauth answers 404 with `meta.secret` / `meta.totp_url` while TOTP is
  // not configured yet — that's the activation payload, not a failure.
  const candidate = error as {
    status?: number;
    meta?: { secret?: string; totp_url?: string };
  } | null;
  if (candidate?.status === 404 && candidate.meta?.secret) {
    return {
      secret: candidate.meta.secret,
      totp_url: candidate.meta.totp_url ?? '',
    };
  }
  return undefined;
}

/** TOTP status: active authenticator (200) or setup payload (404 + secret). */
export function useTotpConfig() {
  const totpQuery = useQuery({
    ...getAuthByClientV1AccountAuthenticatorsTotpOptions({
      path: { client: 'app' },
    }),
    retry: false,
  });

  const setupData = extractSetupData(totpQuery.error);

  return {
    totpAuthenticator: totpQuery.data?.data,
    isTotpActive: Boolean(totpQuery.data?.data),
    setupData,
    isLoading: totpQuery.isLoading,
    // 404-with-secret is the expected "not set up" state, not an error.
    isError: totpQuery.isError && !setupData,
    error: totpQuery.error,
    totpQuery,
  };
}
