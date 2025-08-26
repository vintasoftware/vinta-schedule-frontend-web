import { ProviderSignup } from '@/auth-client';
import { postAuthByClientV1AuthProviderSignupMutation } from '@/auth-client/@tanstack/react-query.gen';
import { useMutation } from '@tanstack/react-query';

export function useProviderSignup() {
  const providerSignupMutation = useMutation({
    ...postAuthByClientV1AuthProviderSignupMutation(),
    retry: (failureCount, error) => {
      return Boolean(error.status && error.status >= 500 && failureCount < 3); // Retry on server errors
    },
  });

  const providerSignup = async (data: ProviderSignup) => {
    const result = await providerSignupMutation.mutateAsync({
      path: {
        client: 'app',
      },
      body: data,
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Token': localStorage.getItem('sessionToken') || '',
      },
    });
    return result;
  };

  return { providerSignup, providerSignupMutation };
}
