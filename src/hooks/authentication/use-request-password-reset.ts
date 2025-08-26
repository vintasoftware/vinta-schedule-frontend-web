import { RequestPassword } from '@/auth-client';
import { postAuthByClientV1AuthPasswordRequestMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';

export function useRequestPasswordReset() {
  const requestPasswordResetMutation = useMutation({
    ...postAuthByClientV1AuthPasswordRequestMutation(),
  });

  const requestPasswordReset = async (data: RequestPassword) => {
    return requestPasswordResetMutation.mutateAsync({
      path: {
        client: 'app',
      },
      body: data,
    });
  };

  return {
    requestPasswordReset,
    requestPasswordResetMutation,
  };
}
