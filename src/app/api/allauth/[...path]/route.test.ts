import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

import { GET, POST, DELETE } from './route';

const BACKEND = 'http://localhost:8000';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let upstreamResponse: () => Response;
let upstreamRequests: Array<{ url: string; sessionToken: string | null }>;

function installFetch() {
  upstreamRequests = [];
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input.toString() : String(input);
    const headers = new Headers(init?.headers);
    upstreamRequests.push({
      url,
      sessionToken: headers.get('X-Session-Token'),
    });
    return upstreamResponse();
  }) as typeof fetch;
}

function makeRequest(
  path: string,
  {
    method = 'GET',
    cookie,
    headers = {},
  }: { method?: string; cookie?: string; headers?: Record<string, string> } = {}
) {
  return new NextRequest(`http://localhost:3000/api/allauth/${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
  });
}

const params = (path: string) =>
  ({ params: Promise.resolve({ path: path.split('/') }) }) as {
    params: Promise<{ path: string[] }>;
  };

describe('allauth BFF proxy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFetch();
  });

  it('forwards to the backend and attaches the httpOnly session cookie as X-Session-Token', async () => {
    upstreamResponse = () =>
      jsonResponse(200, { status: 200, data: [], meta: {} });

    const path = 'auth/app/v1/account/email';
    const response = await GET(
      makeRequest(path, { cookie: 'sessionToken=secret-session' }),
      params(path)
    );

    expect(response.status).toBe(200);
    expect(upstreamRequests[0].url).toBe(`${BACKEND}/${path}`);
    expect(upstreamRequests[0].sessionToken).toBe('secret-session');
  });

  it('ignores an empty incoming X-Session-Token header (legacy hooks) in favor of the cookie', async () => {
    upstreamResponse = () => jsonResponse(200, { status: 200 });

    const path = 'auth/app/v1/auth/email/verify';
    await POST(
      makeRequest(path, {
        method: 'POST',
        cookie: 'sessionToken=from-cookie',
        headers: { 'X-Session-Token': '' },
      }),
      params(path)
    );

    expect(upstreamRequests[0].sessionToken).toBe('from-cookie');
  });

  it('persists a rotated meta.session_token into the cookie and strips it from the body', async () => {
    upstreamResponse = () =>
      jsonResponse(401, {
        status: 401,
        data: { flows: [{ id: 'verify_email', is_pending: true }] },
        meta: { is_authenticated: false, session_token: 'rotated-token' },
      });

    const path = 'auth/app/v1/auth/login';
    const response = await POST(
      makeRequest(path, { method: 'POST' }),
      params(path)
    );

    const setCookies = response.cookies;
    expect(setCookies.get('sessionToken')?.value).toBe('rotated-token');
    expect(setCookies.get('sessionToken')?.httpOnly).toBe(true);
    expect(setCookies.get('sessionTokenPresent')?.value).toBe('1');

    const body = await response.json();
    expect(body.meta.session_token).toBeUndefined();
    expect(body.data.flows[0].id).toBe('verify_email');
  });

  it('re-appends the trailing slash for the custom OAuth endpoints (Django cannot APPEND_SLASH-redirect a POST)', async () => {
    upstreamResponse = () => jsonResponse(200, { redirect_url: 'x' });

    // Next normalizes `/x/` → `/x` before the handler runs, so the incoming
    // path carries no slash — the proxy must restore it.
    const path = 'auth/app/v1/auth/provider/redirect-json';
    await POST(makeRequest(path, { method: 'POST' }), params(path));

    expect(upstreamRequests[0].url).toBe(`${BACKEND}/${path}/`);
  });

  it('persists + strips the custom OAuth endpoints’ top-level session_token', async () => {
    upstreamResponse = () =>
      jsonResponse(200, {
        redirect_url: 'https://accounts.google.com/o/oauth2/auth?x=1',
        session_token: 'connect-session',
      });

    const path = 'auth/app/v1/auth/provider/redirect-json/';
    const response = await POST(
      makeRequest(path, { method: 'POST' }),
      params(path)
    );

    expect(response.cookies.get('sessionToken')?.value).toBe('connect-session');
    const body = await response.json();
    expect(body.session_token).toBeUndefined();
    expect(body.redirect_url).toContain('accounts.google.com');
  });

  it('clears the session cookies on a 410 (session gone)', async () => {
    upstreamResponse = () => jsonResponse(410, { status: 410, data: {} });

    const path = 'auth/app/v1/auth/session';
    const response = await GET(
      makeRequest(path, { cookie: 'sessionToken=stale' }),
      params(path)
    );

    expect(response.status).toBe(410);
    expect(response.cookies.get('sessionToken')?.value).toBe('');
    expect(response.cookies.get('sessionTokenPresent')?.value).toBe('');
  });

  it('clears the session cookies when the session is ended via DELETE', async () => {
    upstreamResponse = () =>
      jsonResponse(401, { status: 401, data: { flows: [] }, meta: {} });

    const path = 'auth/app/v1/auth/session';
    const response = await DELETE(
      makeRequest(path, { method: 'DELETE', cookie: 'sessionToken=live' }),
      params(path)
    );

    expect(response.cookies.get('sessionToken')?.value).toBe('');
  });
});
