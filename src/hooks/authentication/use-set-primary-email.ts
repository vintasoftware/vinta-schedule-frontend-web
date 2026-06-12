import { patchAuthByClientV1AccountEmailMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ACCOUNT_EMAILS_QUERY_KEY } from './use-account-emails';

/** Mark a (verified) email address as the primary one. */
export function useSetPrimaryEmail() {
  const queryClient = useQueryClient();
  const setPrimaryEmailMutation = useMutation({
    ...patchAuthByClientV1AccountEmailMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_EMAILS_QUERY_KEY });
    },
  });

  const setPrimaryEmail = async (email: string) =>
    setPrimaryEmailMutation.mutateAsync({
      path: { client: 'app' },
      body: { email, primary: true },
    });

  return { setPrimaryEmail, setPrimaryEmailMutation };
}
