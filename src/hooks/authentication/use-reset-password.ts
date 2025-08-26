import { ResetPassword } from '@/auth-client';
import { postAuthByClientV1AuthPasswordResetMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';

export function useResetPassword() {
  const resetPasswordMutation = useMutation({
    ...postAuthByClientV1AuthPasswordResetMutation(),
    retry: (failureCount, error) => {
      return Boolean(error.status && error.status >= 500 && failureCount < 3); // Retry on server errors
    },
  });

  const resetPassword = async (data: ResetPassword) => {
    return resetPasswordMutation.mutateAsync({
      path: {
        client: 'app',
      },
      body: data,
    });
  };

  return {
    resetPassword,
    resetPasswordMutation,
  };
}
