import { postAuthByClientV1AuthPhoneVerifyResendMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';

export function useResendPhoneVerificationCode() {
  const resendPhoneVerificationCodeMutation = useMutation({
    ...postAuthByClientV1AuthPhoneVerifyResendMutation(),
    retry: (failureCount, error) => {
      return Boolean(error.status && error.status >= 500 && failureCount < 3); // Retry on server errors
    },
  });

  const resendPhoneVerificationCode = async () => {
    return resendPhoneVerificationCodeMutation.mutateAsync({
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
    resendPhoneVerificationCode,
    resendPhoneVerificationCodeMutation,
  };
}
