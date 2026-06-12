import {
  isAuthenticationResponse,
  isAuthenticatedResponse,
  isInvalidSessionResponse,
} from '@/lib/authentication-response-type-checks';
import { storeAuthTokens } from '@/lib/auth-server-actions';
import { setMemoryAccessToken } from '@/lib/token-storage-strategy.client';
import { persistSessionToken } from '@/lib/session-token';

interface Router {
  push: (path: string) => void;
}

export function useAuthenticationFlowControl(router: Router) {
  return async (response: unknown) => {
    if (isInvalidSessionResponse(response)) {
      localStorage.removeItem('sessionToken');
      document.cookie = `sessionToken=; path=/; Secure; SameSite=Lax; Max-Age=0`;
      document.cookie = `sessionActive=; path=/; Secure; SameSite=Lax; Max-Age=0`;
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
          router.push(`/auth/signup`);
          break;
        case 'verify_email':
          router.push(`/auth/verify-email`);
          break;
        case 'verify_phone':
          router.push(`/auth/verify-phone`);
          break;
        case 'mfa_authenticate':
          router.push(`/auth/mfa-authenticate`);
          break;
        case 'provider_signup':
          router.push(`/auth/social/finish-signup`);
          break;
      }
    } else if (isAuthenticatedResponse(response)) {
      if (response.meta?.access_token) {
        const accessToken = response.meta.access_token;
        const refreshToken = response.meta.refresh_token ?? '';
        // KEEP the session token after login: the allauth account-management
        // endpoints (email/phone/providers/MFA) authenticate exclusively via
        // X-Session-Token — the JWT only covers the app API.
        const sessionToken = (response.meta as { session_token?: string })
          .session_token;
        if (sessionToken) {
          persistSessionToken(sessionToken);
        }
        // Access token in memory only; refresh token as httpOnly cookie via server action.
        setMemoryAccessToken(accessToken);
        if (refreshToken) {
          await storeAuthTokens(accessToken, refreshToken);
        }
      }
      router.push(`/`);
    } else {
      localStorage.removeItem('sessionToken');
      document.cookie = `sessionToken=; path=/; Secure; SameSite=Lax`;
      console.warn('Unhandled response type:', response);
      router.push('/auth/social/error');
    }
  };
}
