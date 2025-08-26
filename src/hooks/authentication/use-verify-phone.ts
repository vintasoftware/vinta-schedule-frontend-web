import { VerifyPhone } from '@/auth-client';
import { postAuthByClientV1AuthPhoneVerifyMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';

export function useVerifyPhone() {
  const verifyPhoneMutation = useMutation({
    ...postAuthByClientV1AuthPhoneVerifyMutation(),
    retry: (failureCount, error) => {
      return Boolean(error.status && error.status >= 500 && failureCount < 3); // Retry on server errors
    },
  });

  const verifyPhone = async (data: VerifyPhone) => {
    return verifyPhoneMutation.mutateAsync({
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
    verifyPhone,
    verifyPhoneMutation,
  };
}
