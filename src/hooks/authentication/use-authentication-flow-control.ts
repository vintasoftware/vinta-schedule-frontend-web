import {
  isAuthenticationResponse,
  isAuthenticatedResponse,
  isInvalidSessionResponse,
} from '@/lib/authentication-response-type-checks';
import { storeAuthTokens } from '@/lib/auth-server-actions';
import { setMemoryAccessToken } from '@/lib/token-storage-strategy.client';
import { persistSessionToken } from '@/lib/session-token';
import { getSafeDestination } from '@/lib/safe-destination';

interface Router {
  push: (path: string) => void;
}

/**
 * Rewrite a destination we can reach without leaving the app into the path to
 * push, or `null` when it genuinely points at another origin.
 *
 * The backend always answers with an *absolute* URL, and for an organization
 * that configured no `redirect_url` of its own that URL is our own dashboard
 * (`FRONTEND_BASE_URL + FRONTEND_DASHBOARD_PATH`) — the common case. Treating
 * every absolute URL as external would make the default post-login hop a full
 * document navigation, which reloads the whole app and discards the in-memory
 * access token set moments earlier, forcing a refresh round-trip on the first
 * API call.
 */
function toInAppRoute(destination: string): string | null {
  if (destination.startsWith('/')) {
    return destination;
  }
  try {
    const url = new URL(destination);
    return url.origin === window.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : null;
  } catch {
    return null;
  }
}

/**
 * Land the freshly-authenticated user.
 *
 * Uses the backend-resolved `destination` — the acting organization's branding
 * `redirect_url`, or our dashboard when it configured none. It is resolved
 * server-side from stored branding, never from a query param or header, so
 * there is no open-redirect surface; `getSafeDestination` is a second line of
 * defence against a malformed value, not the primary control.
 *
 * A white-label tenant's destination lives on its own host, which needs a real
 * document navigation. Anything on our origin routes in-app instead.
 *
 * The fallback only fires against a backend that sends no destination (the
 * field is required by the schema) or one that fails validation. It targets
 * the dashboard rather than `/`, which is the public marketing page and never
 * where a just-authenticated user belongs.
 */
function landAfterAuthentication(router: Router, response: unknown): void {
  const destination = getSafeDestination(
    (response as { destination?: unknown })?.destination
  );

  if (!destination) {
    router.push('/dashboard');
    return;
  }

  const inAppRoute = toInAppRoute(destination);
  if (inAppRoute) {
    router.push(inAppRoute);
    return;
  }

  window.location.assign(destination);
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
      landAfterAuthentication(router, response);
    } else {
      localStorage.removeItem('sessionToken');
      document.cookie = `sessionToken=; path=/; Secure; SameSite=Lax`;
      console.warn('Unhandled response type:', response);
      router.push('/auth/social/error');
    }
  };
}
