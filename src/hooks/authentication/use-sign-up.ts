import { Signup } from '@/auth-client';
import { postAuthByClientV1AuthSignupMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';

export function useSignUp() {
  const signUpMutation = useMutation({
    ...postAuthByClientV1AuthSignupMutation(),
    retry: (failureCount, error) => {
      return Boolean(error.status && error.status >= 500 && failureCount < 3); // Retry on server errors
    },
  });

  const signUp = async (data: Signup) => {
    return await signUpMutation.mutateAsync({
      path: {
        client: 'app',
      },
      body: data,
    });
  };

  return {
    signUp,
    signUpMutation,
  };
}
