import { isAuthenticationResponse, isAuthenticatedResponse, isInvalidSessionResponse } from '@/lib/authentication-response-type-checks';

interface Router {
  push: (path: string) => void;
}

export function useAuthenticationFlowControl(router: Router) {
  return (response: unknown) => {
    if (isInvalidSessionResponse(response)) {
      // Handle invalid session response
      localStorage.removeItem('sessionToken');
      document.cookie = `sessionToken=; path=/; Secure; SameSite=Lax`;
      console.warn('Invalid session detected, redirecting to login');
      router.push('/auth/social/error');
      return;
    } else if (isAuthenticationResponse(response)) {
      const pendingFlow = response.data.flows.filter(
        (flow) => flow.is_pending
      )?.[0];
      if (!pendingFlow) {
        router.push('/auth/social/error');
      }

      if (response.meta?.session_token) {
        localStorage.setItem(
          'sessionToken',
          response.meta?.session_token || ''
        );
        document.cookie = `sessionToken=${response.meta?.session_token || ''}; path=/; Secure; SameSite=Lax`;
      }

      switch (pendingFlow.id) {
        case 'signup':
          // Handle signup flow
          router.push(`/auth/signup`);
          break;
        case 'verify_email':
          // Handle email verification flow
          router.push(`/auth/verify-email`);
          break;

        case 'verify_phone':
          // Handle phone verification flow
          router.push(`/auth/verify-phone`);
          break;

        case 'mfa_authenticate':
          // Handle MFA authentication flow
          router.push(`/auth/mfa-authenticate`);
          break;

        case 'provider_signup':
          // Handle provider signup flow
          router.push(`/auth/social/finish-signup`);
          break;
      }
    } else if (isAuthenticatedResponse(response)) {
      // Handle forbidden access
      if (response.meta?.access_token) {
        const tokens = response.meta?.access_token as unknown as {
          access_token: string;
          refresh_token: string;
        };
        localStorage.removeItem('sessionToken');
        document.cookie = `sessionToken=; path=/; Secure; SameSite=Lax`;
        localStorage.setItem(
          'accessToken',
          (tokens['access_token'] as string) || ''
        );
        document.cookie = `accessToken=${tokens['access_token']}; path=/; Secure; SameSite=Lax`;
        localStorage.setItem(
          'refreshToken',
          (tokens['refresh_token'] as string) || ''
        );
        document.cookie = `refreshToken=${tokens['refresh_token']}; path=/; Secure; SameSite=Lax`;
      }
      router.push(`/`);
    } else {
      // Handle other types of responses
      localStorage.removeItem('sessionToken');
      document.cookie = `sessionToken=; path=/; Secure; SameSite=Lax`;
      console.warn('Unhandled response type:', response);
      router.push('/auth/social/error');
    }
  };
}
