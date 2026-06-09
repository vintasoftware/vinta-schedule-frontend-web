import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { client as authClient } from '@/auth-client/client.gen';

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

  const backendBaseUrl = authClient.getConfig().baseUrl;

  let refreshResponse: Response;
  try {
    refreshResponse = await fetch(`${backendBaseUrl}/auth/app/v1/tokens/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    return NextResponse.json({ error: 'Refresh request failed' }, { status: 502 });
  }

  if (refreshResponse.status === 400) {
    // Refresh token invalid/expired — clear both cookies and force re-login.
    const response = NextResponse.json({ error: 'Refresh token invalid' }, { status: 401 });
    response.cookies.set('accessToken', '', { ...HTTPONLY_COOKIE_OPTIONS, maxAge: 0 });
    response.cookies.set('refreshToken', '', { ...HTTPONLY_COOKIE_OPTIONS, maxAge: 0 });
    return response;
  }

  if (!refreshResponse.ok) {
    return NextResponse.json({ error: 'Refresh failed' }, { status: 502 });
  }

  const { data } = await refreshResponse.json();
  const newAccessToken: string = data.access_token;
  const newRefreshToken: string | undefined = data.refresh_token;

  const response = NextResponse.json({ access_token: newAccessToken });
  response.cookies.set('accessToken', newAccessToken, HTTPONLY_COOKIE_OPTIONS);
  if (newRefreshToken) {
    response.cookies.set('refreshToken', newRefreshToken, HTTPONLY_COOKIE_OPTIONS);
  }
  return response;
}
