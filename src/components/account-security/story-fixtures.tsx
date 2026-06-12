'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Shared Storybook plumbing for the account-security stories: a fetch stub
// keyed by URL substring (first match wins — list specific paths before
// generic ones) plus a fresh QueryClient per story so states don't leak.
// Not a story file; Storybook ignores it.
// ---------------------------------------------------------------------------

export type StubHandler = [match: string, body: unknown, status?: number];

export function makeFetchStub(handlers: StubHandler[]) {
  return (input: RequestInfo | URL): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    for (const [match, body, status = 200] of handlers) {
      if (url.includes(match)) {
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' },
          })
        );
      }
    }
    return Promise.resolve(new Response('{}', { status: 200 }));
  };
}

export function AuthStub({
  handlers,
  children,
}: {
  handlers: StubHandler[];
  children: React.ReactNode;
}) {
  // Stubbing the global fetch is this Storybook-only helper's whole job; it
  // must happen during render, before React Query fires in child effects.
  // eslint-disable-next-line react-hooks/immutability
  global.fetch = makeFetchStub(handlers) as typeof global.fetch;
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      })
  );
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ---------------------------------------------------------------------------
// Fixture payloads (allauth response shapes)
// ---------------------------------------------------------------------------

export const SESSION_WITH_PASSWORD: StubHandler = [
  '/auth/session',
  {
    status: 200,
    data: {
      user: { id: 1, email: 'ada@example.com', has_usable_password: true },
    },
    meta: { is_authenticated: true },
  },
];

export const SESSION_SOCIAL_NO_PASSWORD: StubHandler = [
  '/auth/session',
  {
    status: 200,
    data: {
      user: { id: 1, email: 'ada@example.com', has_usable_password: false },
    },
    meta: { is_authenticated: true },
  },
];

export const CONFIG_FULL: StubHandler = [
  '/config',
  {
    status: 200,
    data: {
      account: {},
      socialaccount: {
        providers: [
          { id: 'google', name: 'Google', flows: ['provider_redirect'] },
          { id: 'apple', name: 'Apple', flows: ['provider_redirect'] },
          { id: 'facebook', name: 'Facebook', flows: ['provider_redirect'] },
        ],
      },
      mfa: { supported_types: ['totp', 'recovery_codes'] },
    },
  },
];

export const LINKED_GOOGLE: StubHandler = [
  '/account/providers',
  {
    status: 200,
    data: [
      {
        display: 'ada@gmail.com',
        uid: 'google-uid-1',
        provider: {
          id: 'google',
          name: 'Google',
          flows: ['provider_redirect'],
        },
      },
    ],
  },
];

export const TOTP_ACTIVE: StubHandler = [
  '/account/authenticators/totp',
  {
    status: 200,
    data: { type: 'totp', created_at: 1718000000, last_used_at: 1718600000 },
  },
];

export const TOTP_NOT_SET_UP: StubHandler = [
  '/account/authenticators/totp',
  {
    status: 404,
    meta: {
      secret: 'JBSWY3DPEHPK3PXP',
      totp_url:
        'otpauth://totp/Vinta%20Schedule:ada%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Vinta%20Schedule',
    },
  },
  404,
];

export const RECOVERY_CODES: StubHandler = [
  '/account/authenticators/recovery-codes',
  {
    status: 200,
    data: {
      type: 'recovery_codes',
      created_at: 1718000000,
      total_code_count: 10,
      unused_code_count: 7,
      unused_codes: [
        'q4f2-9xkz',
        '8mwt-p3vd',
        'kc7n-2hqr',
        'jx5b-tw9s',
        '3zfg-md4c',
        'vh8p-7nkb',
        'r2ys-x6qm',
      ],
    },
  },
];

export const AUTHENTICATORS: StubHandler = [
  '/account/authenticators',
  {
    status: 200,
    data: [{ type: 'totp', created_at: 1718000000, last_used_at: 1718600000 }],
  },
];

export const ACCOUNT_EMAILS: StubHandler = [
  '/account/email',
  {
    status: 200,
    data: [
      { email: 'ada@example.com', primary: true, verified: true },
      { email: 'ada@work.example.com', primary: false, verified: true },
      { email: 'ada@new.example.com', primary: false, verified: false },
    ],
  },
];

export const ACCOUNT_PHONE_VERIFIED: StubHandler = [
  '/account/phone',
  { status: 200, data: [{ phone: '+1 555 555 5555', verified: true }] },
];

export const ACCOUNT_PHONE_NONE: StubHandler = [
  '/account/phone',
  { status: 200, data: [] },
];

/** Everything wired for a fully-populated security page. */
export const DEFAULT_HANDLERS: StubHandler[] = [
  // Specific paths first — the stub matches by substring in order.
  TOTP_ACTIVE,
  RECOVERY_CODES,
  AUTHENTICATORS,
  ACCOUNT_EMAILS,
  ACCOUNT_PHONE_VERIFIED,
  LINKED_GOOGLE,
  CONFIG_FULL,
  SESSION_WITH_PASSWORD,
];
