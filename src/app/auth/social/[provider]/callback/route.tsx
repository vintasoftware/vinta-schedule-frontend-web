import { NextResponse } from 'next/server';
import '@/lib/configure-api-clients';
import { postAppV1AuthProviderCallbackJson } from '@/addicional-auth-client/provider-login-callback-json';
import {
  isAuthenticatedResponse,
  isAuthenticationResponse,
} from '@/lib/authentication-response-type-checks';
import { cookies } from 'next/headers';
import type { AuthenticationResponse, Flow } from '@/auth-client';
// Removed invalid import of CookieOptions

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const body = await request.json();
  const { provider } = await params;

  const { url, cookiesToSet, cookiesToUnset } =
    await handleProviderLoginCallback(provider, body);
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'http';

  const requestBaseUrl = `${protocol}://${host}`;
  const response = NextResponse.redirect(`${requestBaseUrl}${url}`);
  cookiesToSet?.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  cookiesToUnset?.forEach((name) => {
    response.cookies.delete(name);
  });
  console.log('Redirecting to:', url);
  console.log('Cookies to set:', cookiesToSet);
  console.log('Cookies to unset:', cookiesToUnset);
  console.log('Request base URL:', requestBaseUrl);
  return response;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const searchParams = new URL(request.url).searchParams;
  const { provider } = await params;

  const { url, cookiesToSet, cookiesToUnset } =
    await handleProviderLoginCallback(
      provider,
      Object.fromEntries(searchParams.entries())
    );
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'http';

  const requestBaseUrl = `${protocol}://${host}`;

  const response = NextResponse.redirect(`${requestBaseUrl}${url}`);
  cookiesToSet?.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  cookiesToUnset?.forEach((name) => {
    response.cookies.delete(name);
  });
  console.log('Redirecting to:', url);
  console.log('Cookies to set:', cookiesToSet);
  console.log('Cookies to unset:', cookiesToUnset);
  console.log('Request base URL:', requestBaseUrl);
  return response;
}

type CookieOptions = {
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  // Add other cookie options if needed
};

type CallbackResult = {
  url: string;
  cookiesToSet?: Array<{
    name: string;
    value: string;
    options?: CookieOptions;
  }>;
  cookiesToUnset?: Array<string>;
};

// Where each pending allauth flow continues. Mirrors the client-side
// `useAuthenticationFlowControl` routing so the social callback and the
// in-app session checks send the user to the same place.
const PENDING_FLOW_ROUTES: Partial<Record<Flow['id'], string>> = {
  provider_signup: '/auth/social/finish-signup',
  verify_phone: '/auth/verify-phone',
  verify_email: '/auth/verify-email',
  mfa_authenticate: '/auth/mfa-authenticate',
};

/**
 * A 401 with `data.flows` is the intended allauth "more steps required"
 * contract — NOT an error. It happens both for a brand-new social account
 * (`provider_signup`, still needs e.g. a phone) and for a returning user whose
 * login needs another step (`verify_phone`, `mfa_authenticate`, …). Route to
 * that step on the SAME session.
 *
 * Session-token rule: allauth only emits `meta.session_token` when the token is
 * new or rotated, so these 401s often omit it. Keep using the token we already
 * hold (from the `redirect-json` step, carried as the `sessionToken` cookie /
 * `X-Session-Token` on the callback); only replace it when the response rotates
 * it. The follow-up request must run on this same session or the backend 409s.
 */
function handlePendingAuthenticationResponse(
  response: AuthenticationResponse,
  incomingSessionToken: string | undefined
): CallbackResult {
  // Prefer a rotated token; otherwise keep the one we authenticated with.
  const sessionToken = response.meta?.session_token ?? incomingSessionToken;
  const pendingFlow = response.data.flows.find((flow) => flow.is_pending);
  const nextUrl = pendingFlow && PENDING_FLOW_ROUTES[pendingFlow.id];

  if (!nextUrl) {
    console.error(
      'Authentication response without a routable pending flow',
      JSON.stringify(response)
    );
    return {
      url: `/auth/social/error`,
      cookiesToUnset: ['accessToken', 'refreshToken', 'sessionToken', 'sessionActive'],
    };
  }

  if (!sessionToken) {
    console.error(
      `Pending ${pendingFlow.id} flow but no session token (none stored from redirect-json, none rotated)`
    );
    return {
      url: `/auth/social/error`,
      cookiesToUnset: ['accessToken', 'refreshToken', 'sessionToken', 'sessionActive'],
    };
  }

  return {
    url: nextUrl,
    cookiesToSet: [
      {
        name: 'sessionToken',
        value: sessionToken,
        options: { secure: true, httpOnly: false, sameSite: 'lax' },
      },
    ],
    cookiesToUnset: ['accessToken', 'refreshToken'],
  };
}

export async function handleProviderLoginCallback(
  provider: string,
  params: Record<string, string>
): Promise<CallbackResult> {
  const cookieStorage = await cookies();
  // The session_token persisted by the `redirect-json` step. We must keep
  // sending it as X-Session-Token on the callback (and forward it to signup),
  // since the pending 401 won't re-issue it.
  const incomingSessionToken =
    cookieStorage.get('sessionToken')?.value || undefined;
  const cookiesToSet: Array<{
    name: string;
    value: string;
    options?: CookieOptions;
  }> = [];
  const cookiesToUnset: Array<string> = [];
  try {
    const response = await (
      await postAppV1AuthProviderCallbackJson({
        provider,
        queryParams: params,
        sessionToken: incomingSessionToken,
      })
    ).json();

    if (isAuthenticatedResponse(response)) {
      if (!response.meta?.access_token) {
        console.error(
          'Authentication successful, but no access token found in response meta'
        );
        cookiesToUnset.push('sessionToken');
        cookiesToUnset.push('accessToken');
        cookiesToUnset.push('refreshToken');
        return { url: `/auth/social/error`, cookiesToUnset };
      }
      // native headless `app` flow: meta carries three separate tokens.
      const accessToken = response.meta.access_token;
      const refreshToken = response.meta.refresh_token;

      if (!accessToken || !refreshToken) {
        console.error(
          'Authentication successful, but access or refresh token is missing'
        );
        return { url: `/auth/social/error` };
      }

      cookiesToSet.push({
        name: 'accessToken',
        value: accessToken,
        options: { secure: true, httpOnly: true, sameSite: 'lax' },
      });

      cookiesToSet.push({
        name: 'refreshToken',
        value: refreshToken,
        options: { secure: true, httpOnly: true, sameSite: 'lax' },
      });

      cookiesToSet.push({
        name: 'sessionActive',
        value: '1',
        options: { secure: true, httpOnly: false, sameSite: 'lax' },
      });

      cookiesToUnset.push('sessionToken');

      return {
        url: `/auth/social/${provider}/success`,
        cookiesToSet,
        cookiesToUnset,
      };
    }

    // A 401 with `data.flows` is the intended allauth "more steps required"
    // contract (e.g. a new Google user that still needs a phone number).
    // `redirect: 'manual'` fetch does NOT throw on 401, so this arrives here as
    // a normal response body — handle it instead of erroring.
    if (isAuthenticationResponse(response)) {
      return handlePendingAuthenticationResponse(
        response,
        incomingSessionToken
      );
    }

    console.error(
      'Response is not an authenticated response, redirecting to error page',
      JSON.stringify(response)
    );
  } catch (error) {
    // Defensive: if some transport ever surfaces the 401 as a throw instead of
    // a response body, treat it the same way.
    if (isAuthenticationResponse(error)) {
      return handlePendingAuthenticationResponse(error, incomingSessionToken);
    } else {
      console.error('Error during provider login callback:', error);
      cookiesToUnset.push('accessToken');
      cookiesToUnset.push('refreshToken');
      cookiesToUnset.push('sessionToken');
      return { url: `/auth/social/error`, cookiesToSet, cookiesToUnset };
    }
  }

  console.warn(
    'No valid authentication response received, redirecting to error'
  );
  return { url: `/auth/social/error`, cookiesToSet, cookiesToUnset };
}
