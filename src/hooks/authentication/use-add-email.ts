import { postAuthByClientV1AccountEmailMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ACCOUNT_EMAILS_QUERY_KEY } from './use-account-emails';

/** Add an email address — triggers code-based verification to that address. */
export function useAddEmail() {
  const queryClient = useQueryClient();
  const addEmailMutation = useMutation({
    ...postAuthByClientV1AccountEmailMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_EMAILS_QUERY_KEY });
    },
  });

  const addEmail = async (email: string) =>
    addEmailMutation.mutateAsync({
      path: { client: 'app' },
      body: { email },
    });

  return { addEmail, addEmailMutation };
}
