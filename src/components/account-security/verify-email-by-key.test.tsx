import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/lib/auth-server-actions', () => ({
  storeAuthTokens: vi.fn(),
  clearAuthCookies: vi.fn(),
}));

import { VerifyEmailByKey } from './verify-email-by-key';

const VERIFY_URL = 'http://localhost:8000/auth/app/v1/auth/email/verify';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

let verifyResponse: () => Response;
let sentKey: unknown;

function installFetch() {
  sentKey = undefined;
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const request = input as Request;
    if (
      request.url.startsWith(VERIFY_URL) &&
      request.method.toUpperCase() === 'POST'
    ) {
      sentKey = (await request.clone().json()) as { key?: string };
      return verifyResponse();
    }
    return jsonResponse(404, {});
  }) as typeof fetch;
}

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return render(<VerifyEmailByKey verificationKey='the-emailed-key' />, {
    wrapper: Wrapper,
  });
}

describe('VerifyEmailByKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFetch();
  });

  it('auto-submits the key and shows success', async () => {
    verifyResponse = () => jsonResponse(200, { status: 200 });
    renderComponent();

    expect(
      await screen.findByText('Your email address has been verified.')
    ).toBeInTheDocument();
    expect(sentKey).toEqual({ key: 'the-emailed-key' });
  });

  it('shows the backend message for an invalid key', async () => {
    verifyResponse = () =>
      jsonResponse(400, {
        status: 400,
        errors: [
          {
            code: 'invalid_or_expired_key',
            message: 'Invalid or expired key.',
          },
        ],
      });
    renderComponent();

    expect(
      await screen.findByText('Invalid or expired key.')
    ).toBeInTheDocument();
  });
});
