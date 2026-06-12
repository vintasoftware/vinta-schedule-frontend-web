import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import '@/lib/configure-api-clients';
import { postAuthAppV1TokensRefresh } from '@/auth-client/sdk.gen';
import { serverBufferedFetch } from '@/lib/server-buffered-fetch';

const HTTPONLY_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refreshToken')?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  let refreshResult: Awaited<ReturnType<typeof postAuthAppV1TokensRefresh>>;
  try {
    refreshResult = await postAuthAppV1TokensRefresh({
      body: { refresh_token: refreshToken },
      // Node fetch chunks Request-stream bodies; Django's dev server can't
      // parse chunked uploads. Buffer the body so Content-Length is sent.
      fetch: serverBufferedFetch,
    });
  } catch {
    return NextResponse.json(
      { error: 'Refresh request failed' },
      { status: 502 }
    );
  }

  if (refreshResult.response?.status === 400) {
    // Refresh token invalid/expired — clear both cookies and force re-login.
    const response = NextResponse.json(
      { error: 'Refresh token invalid' },
      { status: 401 }
    );
    response.cookies.set('accessToken', '', {
      ...HTTPONLY_COOKIE_OPTIONS,
      maxAge: 0,
    });
    response.cookies.set('refreshToken', '', {
      ...HTTPONLY_COOKIE_OPTIONS,
      maxAge: 0,
    });
    return response;
  }

  if (!refreshResult.data) {
    return NextResponse.json({ error: 'Refresh failed' }, { status: 502 });
  }

  const newAccessToken: string = refreshResult.data.data.access_token;
  const newRefreshToken: string | undefined =
    refreshResult.data.data.refresh_token;

  const response = NextResponse.json({ access_token: newAccessToken });
  response.cookies.set('accessToken', newAccessToken, HTTPONLY_COOKIE_OPTIONS);
  if (newRefreshToken) {
    response.cookies.set(
      'refreshToken',
      newRefreshToken,
      HTTPONLY_COOKIE_OPTIONS
    );
  }
  return response;
}
