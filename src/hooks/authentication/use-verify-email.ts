import { VerifyEmail } from '@/auth-client';
import { postAuthByClientV1AuthEmailVerifyMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';

export function useVerifyEmail() {
  const verifyEmailMutation = useMutation({
    ...postAuthByClientV1AuthEmailVerifyMutation(),
    retry: (failureCount, error) => {
      return Boolean(error.status && error.status >= 500 && failureCount < 3); // Retry on server errors
    },
  });

  const verifyEmail = async (data: VerifyEmail) => {
    return verifyEmailMutation.mutateAsync({
      path: {
        client: 'app',
      },
      body: data,
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': localStorage.getItem('sessionToken') || '',
      },
    });
  };

  return {
    verifyEmail,
    verifyEmailMutation,
  };
}
