import { deleteAuthByClientV1AccountEmailMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ACCOUNT_EMAILS_QUERY_KEY } from './use-account-emails';

export function useRemoveEmail() {
  const queryClient = useQueryClient();
  const removeEmailMutation = useMutation({
    ...deleteAuthByClientV1AccountEmailMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ACCOUNT_EMAILS_QUERY_KEY });
    },
  });

  const removeEmail = async (email: string) =>
    removeEmailMutation.mutateAsync({
      path: { client: 'app' },
      body: { email },
    });

  return { removeEmail, removeEmailMutation };
}
