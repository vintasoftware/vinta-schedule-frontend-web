import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { EmailsSection } from './emails-section';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const EMAIL_URL = 'http://localhost:8000/auth/app/v1/account/email';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const EMAILS = [
  { email: 'primary@example.com', primary: true, verified: true },
  { email: 'second@example.com', primary: false, verified: false },
];

let addEmailResponse: () => Response;

function installFetch() {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const request = input as Request;
    const method = request.method.toUpperCase();
    if (request.url.startsWith(EMAIL_URL) && method === 'GET') {
      return jsonResponse(200, { status: 200, data: EMAILS });
    }
    if (request.url.startsWith(EMAIL_URL) && method === 'POST') {
      return addEmailResponse();
    }
    return jsonResponse(404, {});
  }) as typeof fetch;
}

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return render(<EmailsSection />, { wrapper: Wrapper });
}

describe('EmailsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFetch();
  });

  it('lists addresses with primary/verified badges and per-state actions', async () => {
    renderSection();

    expect(await screen.findByText('primary@example.com')).toBeInTheDocument();
    expect(screen.getByText('second@example.com')).toBeInTheDocument();
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Unverified')).toBeInTheDocument();
    // The unverified address can be verified and removed, not made primary.
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Make primary' })
    ).not.toBeInTheDocument();
  });

  it('adds an email and opens the verification dialog', async () => {
    const user = userEvent.setup();
    addEmailResponse = () =>
      jsonResponse(200, {
        status: 200,
        data: [
          ...EMAILS,
          { email: 'new@example.com', primary: false, verified: false },
        ],
      });
    renderSection();

    await screen.findByText('primary@example.com');
    await user.type(
      screen.getByPlaceholderText('new-address@example.com'),
      'new@example.com'
    );
    await user.click(screen.getByRole('button', { name: 'Add email' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Verification code sent to new@example.com.'
      )
    );
    // Verification dialog opens for the new address.
    expect(
      await screen.findByText('Verify new@example.com')
    ).toBeInTheDocument();
  });

  it('maps an allauth 400 on add onto the email field', async () => {
    const user = userEvent.setup();
    addEmailResponse = () =>
      jsonResponse(400, {
        status: 400,
        errors: [
          {
            code: 'email_taken',
            message: 'This email is already in use.',
            param: 'email',
          },
        ],
      });
    renderSection();

    await screen.findByText('primary@example.com');
    await user.type(
      screen.getByPlaceholderText('new-address@example.com'),
      'dupe@example.com'
    );
    await user.click(screen.getByRole('button', { name: 'Add email' }));

    expect(
      await screen.findByText('This email is already in use.')
    ).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
