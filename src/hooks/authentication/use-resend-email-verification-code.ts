import { postAuthByClientV1AuthEmailVerifyResendMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';

export function useResendEmailVerificationCode() {
  const resendEmailVerificationCodeMutation = useMutation({
    ...postAuthByClientV1AuthEmailVerifyResendMutation(),
    retry: (failureCount, error) => {
      return Boolean(error.status && error.status >= 500 && failureCount < 3); // Retry on server errors
    },
  });

  const resendEmailVerificationCode = async () => {
    return resendEmailVerificationCodeMutation.mutateAsync({
      path: {
        client: 'app',
      },
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': localStorage.getItem('sessionToken') || '',
      },
    });
  };

  return {
    resendEmailVerificationCode,
    resendEmailVerificationCodeMutation,
  };
}
