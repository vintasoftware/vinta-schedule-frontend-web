import { NextResponse } from 'next/server';
import '@/lib/configure-api-clients';
import { postAppV1AuthProviderCallbackJson } from '@/addicional-auth-client/provider-login-callback-json';
import {
  isAuthenticatedResponse,
  isAuthenticationResponse,
} from '@/lib/authentication-response-type-checks';
import { cookies } from 'next/headers';
import type { AuthenticationResponse, Flow } from '@/auth-client';
import { fetchValidatedReturnUrl } from '@/lib/branding-server';
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
  // Only prefix the base URL for relative (path) URLs; absolute external URLs
  // (allowlisted reseller return URLs) are used as-is to avoid producing a
  // garbage host like "https://vinta.comhttps://app.reseller.com/...".
  const destination = /^https?:\/\//i.test(url)
    ? url
    : `${requestBaseUrl}${url}`;
  const response = NextResponse.redirect(destination);
  cookiesToSet?.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  cookiesToUnset?.forEach((name) => {
    response.cookies.delete(name);
  });
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
  // Only prefix the base URL for relative (path) URLs; absolute external URLs
  // (allowlisted reseller return URLs) are used as-is to avoid producing a
  // garbage host like "https://vinta.comhttps://app.reseller.com/...".
  const destination = /^https?:\/\//i.test(url)
    ? url
    : `${requestBaseUrl}${url}`;
  const response = NextResponse.redirect(destination);
  cookiesToSet?.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  cookiesToUnset?.forEach((name) => {
    response.cookies.delete(name);
  });
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
  incomingSessionToken: string | undefined,
  tenantId?: string | null
): CallbackResult {
  // Prefer a rotated token; otherwise keep the one we authenticated with.
  const sessionToken = response.meta?.session_token ?? incomingSessionToken;
  const pendingFlow = response.data.flows.find((flow) => flow.is_pending);
  const baseNextUrl = pendingFlow && PENDING_FLOW_ROUTES[pendingFlow.id];

  if (!baseNextUrl) {
    console.error(
      'Authentication response without a routable pending flow',
      JSON.stringify(response)
    );
    const errorUrl = tenantId
      ? `/auth/social/error?tenant_id=${encodeURIComponent(tenantId)}`
      : `/auth/social/error`;
    return {
      url: errorUrl,
      cookiesToUnset: [
        'accessToken',
        'refreshToken',
        'sessionToken',
        'sessionActive',
      ],
    };
  }

  if (!sessionToken) {
    console.error(
      `Pending ${pendingFlow.id} flow but no session token (none stored from redirect-json, none rotated)`
    );
    const errorUrl = tenantId
      ? `/auth/social/error?tenant_id=${encodeURIComponent(tenantId)}`
      : `/auth/social/error`;
    return {
      url: errorUrl,
      cookiesToUnset: [
        'accessToken',
        'refreshToken',
        'sessionToken',
        'sessionActive',
      ],
    };
  }

  // Thread the tenant_id into the pending-flow URL so the interstitial page
  // can resolve branding from the same tenant context.
  const nextUrl = tenantId
    ? `${baseNextUrl}?tenant_id=${encodeURIComponent(tenantId)}`
    : baseNextUrl;

  return {
    url: nextUrl,
    cookiesToSet: [
      // The session token is a credential — httpOnly, read only by server
      // code (the /api/allauth proxy). Client JS gets the presence flag.
      {
        name: 'sessionToken',
        value: sessionToken,
        options: { secure: true, httpOnly: true, sameSite: 'lax' },
      },
      {
        name: 'sessionTokenPresent',
        value: '1',
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

  // The tenant_id may be embedded in the OAuth state param (set by the
  // initiating page) or passed as a direct query param. If present, we use it
  // to fetch tenant branding for interstitials and to validate the `next` URL.
  const tenantId = params.tenant_id || null;

  // The `next` / return-URL the reseller's app wants to send the user back to
  // after login. MUST be validated server-side against the tenant's allowlist
  // before use. An absent or off-allowlist URL falls back to the default
  // dashboard (no open-redirect risk).
  const nextParam = params.next || null;
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
        const errorUrl = tenantId
          ? `/auth/social/error?tenant_id=${encodeURIComponent(tenantId)}`
          : `/auth/social/error`;
        return { url: errorUrl, cookiesToUnset };
      }
      // native headless `app` flow: meta carries three separate tokens.
      const accessToken = response.meta.access_token;
      const refreshToken = response.meta.refresh_token;

      if (!accessToken || !refreshToken) {
        console.error(
          'Authentication successful, but access or refresh token is missing'
        );
        const errorUrl = tenantId
          ? `/auth/social/error?tenant_id=${encodeURIComponent(tenantId)}`
          : `/auth/social/error`;
        return { url: errorUrl };
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

      // KEEP the session token after full login — allauth account-management
      // endpoints (email/phone/providers/MFA) authenticate via X-Session-Token
      // (attached by the /api/allauth proxy from this httpOnly cookie).
      const sessionToken =
        (response.meta as { session_token?: string }).session_token ??
        incomingSessionToken;
      if (sessionToken) {
        cookiesToSet.push({
          name: 'sessionToken',
          value: sessionToken,
          options: { secure: true, httpOnly: true, sameSite: 'lax' },
        });
        cookiesToSet.push({
          name: 'sessionTokenPresent',
          value: '1',
          options: { secure: true, httpOnly: false, sameSite: 'lax' },
        });
      }

      // Determine the post-login redirect URL.
      // If a `next` param was supplied, ask the backend to validate it against
      // the tenant's return-URL allowlist. The backend performs ALL matching
      // and scheme-guard logic and returns the sanitized URL only when allowed.
      // An absent/invalid/off-allowlist URL falls back to the success
      // interstitial (which then redirects to /dashboard). Fail closed.
      const validatedNext = await fetchValidatedReturnUrl(tenantId, nextParam);
      let successUrl: string;
      if (validatedNext) {
        // The backend confirmed the URL is allowed — redirect directly there.
        // sanitizedUrl is an absolute URL so no origin prefix is needed.
        successUrl = validatedNext;
      } else {
        // Off-allowlist, failed validation, or no next param — use the
        // standard success interstitial.
        const base = `/auth/social/${provider}/success`;
        successUrl = tenantId
          ? `${base}?tenant_id=${encodeURIComponent(tenantId)}`
          : base;
      }

      return {
        url: successUrl,
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
        incomingSessionToken,
        tenantId
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
      return handlePendingAuthenticationResponse(
        error,
        incomingSessionToken,
        tenantId
      );
    } else {
      console.error('Error during provider login callback:', error);
      cookiesToUnset.push('accessToken');
      cookiesToUnset.push('refreshToken');
      cookiesToUnset.push('sessionToken');
      const errorUrl = tenantId
        ? `/auth/social/error?tenant_id=${encodeURIComponent(tenantId)}`
        : `/auth/social/error`;
      return { url: errorUrl, cookiesToSet, cookiesToUnset };
    }
  }

  console.warn(
    'No valid authentication response received, redirecting to error'
  );
  const errorUrl = tenantId
    ? `/auth/social/error?tenant_id=${encodeURIComponent(tenantId)}`
    : `/auth/social/error`;
  return { url: errorUrl, cookiesToSet, cookiesToUnset };
}
