import { getAuthByClientV1AccountEmailOptions } from '@/auth-client/@tanstack/react-query.gen';
import { useQuery } from '@tanstack/react-query';

export const ACCOUNT_EMAILS_QUERY_KEY = getAuthByClientV1AccountEmailOptions({
  path: { client: 'app' },
}).queryKey;

/** Email addresses on the account, with `verified` / `primary` flags. */
export function useAccountEmails() {
  const emailsQuery = useQuery({
    ...getAuthByClientV1AccountEmailOptions({
      path: { client: 'app' },
    }),
    retry: false,
  });

  return {
    emails: emailsQuery.data?.data ?? [],
    isLoading: emailsQuery.isLoading,
    isError: emailsQuery.isError,
    error: emailsQuery.error,
    emailsQuery,
  };
}
