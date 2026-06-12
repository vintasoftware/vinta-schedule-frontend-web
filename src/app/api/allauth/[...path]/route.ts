import { NextRequest, NextResponse } from 'next/server';

/**
 * BFF proxy for the allauth headless API.
 *
 * The allauth session token is a full login credential (it authenticates all
 * account-management endpoints), so it must not be readable by client-side
 * JS. The browser auth client points here instead of at the backend; this
 * handler:
 *
 *   1. attaches `X-Session-Token` from the httpOnly `sessionToken` cookie,
 *   2. persists each rotated `meta.session_token` (or the custom OAuth
 *      endpoints' top-level `session_token`) back into that cookie, and
 *   3. STRIPS the token from the body before it reaches the browser, setting
 *      the JS-readable `sessionTokenPresent` flag instead so client code can
 *      still gate "is a session in progress?" logic.
 *
 * A 410 (session gone) clears both cookies, as does ending the session via
 * `DELETE /auth/{client}/v1/auth/session`.
 */

const BACKEND_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};

const FLAG_COOKIE_OPTIONS = {
  httpOnly: false,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};

function clearSessionCookies(response: NextResponse) {
  response.cookies.set('sessionToken', '', {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
  response.cookies.set('sessionTokenPresent', '', {
    ...FLAG_COOKIE_OPTIONS,
    maxAge: 0,
  });
}

// The two custom OAuth endpoints are Django views registered WITH a trailing
// slash; everything else in allauth headless is slash-less. The slash can't
// be recovered from the request (catch-all params drop it, and Next 308s
// `/x/` → `/x` before the handler runs), and Django can't APPEND_SLASH-
// redirect a POST — so re-append it for these endpoints explicitly.
const TRAILING_SLASH_ENDPOINTS = ['redirect-json', 'callback-json'];

async function proxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const segments = path.filter(Boolean);
  const needsTrailingSlash =
    request.nextUrl.pathname.endsWith('/') ||
    TRAILING_SLASH_ENDPOINTS.includes(segments[segments.length - 1]);
  const target = new URL(
    `${BACKEND_BASE_URL}/${segments.join('/')}${needsTrailingSlash ? '/' : ''}`
  );
  target.search = request.nextUrl.search;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  // Device-tracking headers are recorded per refresh token server-side.
  request.headers.forEach((value, key) => {
    if (key.toLowerCase().startsWith('x-device-')) headers.set(key, value);
  });

  // Transitional: an explicitly-set (non-empty) header wins; otherwise the
  // httpOnly cookie is the source of truth. Several legacy hooks send
  // `X-Session-Token: ''` from a now-empty localStorage — ignore those.
  const incomingToken = request.headers.get('x-session-token');
  const sessionToken =
    incomingToken || request.cookies.get('sessionToken')?.value;
  if (sessionToken) headers.set('X-Session-Token', sessionToken);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body:
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : await request.arrayBuffer(),
      redirect: 'manual',
    });
  } catch {
    return NextResponse.json(
      { error: 'Authentication service unreachable' },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    // non-JSON upstream body — pass through untouched below
  }

  let rotatedToken: string | undefined;
  if (body && typeof body === 'object') {
    const payload = body as {
      meta?: { session_token?: string };
      session_token?: string;
    };
    rotatedToken = payload.meta?.session_token ?? payload.session_token;
    if (payload.meta?.session_token) delete payload.meta.session_token;
    if (payload.session_token) delete payload.session_token;
  }

  const response =
    body !== null
      ? NextResponse.json(body, { status: upstream.status })
      : new NextResponse(text, {
          status: upstream.status,
          headers: {
            'content-type':
              upstream.headers.get('content-type') ?? 'text/plain',
          },
        });

  const isSessionEnd =
    request.method === 'DELETE' && target.pathname.endsWith('/auth/session');

  if (upstream.status === 410 || isSessionEnd) {
    clearSessionCookies(response);
  } else if (rotatedToken) {
    response.cookies.set('sessionToken', rotatedToken, SESSION_COOKIE_OPTIONS);
    response.cookies.set('sessionTokenPresent', '1', FLAG_COOKIE_OPTIONS);
  }

  return response;
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
};
