import { NextResponse } from 'next/server';
import { postAppV1AuthProviderCallbackJson } from '@/addicional-auth-client/provider-login-callback-json';
import {
  isAuthenticatedResponse,
  isAuthenticationResponse,
} from '@/lib/authentication-response-type-checks';
import { cookies } from 'next/headers';
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

async function handleProviderLoginCallback(
  provider: string,
  params: Record<string, string>
): Promise<{
  url: string;
  cookiesToSet?: Array<{
    name: string;
    value: string;
    options?: CookieOptions;
  }>;
  cookiesToUnset?: Array<string>;
}> {
  const cookieStorage = await cookies();
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
        sessionToken: cookieStorage.get('sessionToken')?.value || undefined,
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
      const tokens = response.meta?.access_token as unknown as {
        access_token: string;
        refresh_token: string;
      };

      if (!tokens.access_token || !tokens.refresh_token) {
        console.error(
          'Authentication successful, but access or refresh token is missing'
        );
        return { url: `/auth/social/error` };
      }

      cookiesToSet.push({
        name: 'accessToken',
        value: tokens.access_token,
        options: {
          secure: true,
          httpOnly: false,
          sameSite: 'lax',
        },
      });

      cookiesToSet.push({
        name: 'refreshToken',
        value: tokens.refresh_token,
        options: {
          secure: true,
          httpOnly: false,
          sameSite: 'lax',
        },
      });

      cookiesToUnset.push('sessionToken');

      console.log('Access and refresh tokens set successfully:', tokens);

      return {
        url: `/auth/social/${provider}/success`,
        cookiesToSet,
        cookiesToUnset,
      };
    }
    console.error(
      'Response is not an authenticated response, redirecting to error page',
      response
    );
  } catch (error) {
    if (isAuthenticationResponse(error)) {
      const {
        meta: { session_token: sessionToken },
      } = error;

      if (!sessionToken) {
        console.error(
          'Authentication response received, but no session token found'
        );
        return { url: `/auth/social/error` };
      }

      cookiesToSet.push({
        name: 'sessionToken',
        value: sessionToken,
        options: {
          secure: true,
          httpOnly: false,
          sameSite: 'lax',
        },
      });

      cookiesToUnset.push('accessToken');
      cookiesToUnset.push('refreshToken');

      console.log('Session token set successfully:', sessionToken);

      return {
        url: `/auth/social/${provider}/success`,
        cookiesToSet,
        cookiesToUnset,
      };
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
