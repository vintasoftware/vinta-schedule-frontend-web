import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { PhoneVerifyDialog } from './phone-verify-dialog';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const VERIFY_URL = 'http://localhost:8000/auth/app/v1/auth/phone/verify';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const INCORRECT_CODE = () =>
  jsonResponse(400, {
    status: 400,
    errors: [{ code: 'incorrect_code', message: 'Incorrect code.' }],
  });

let verifyResponse: () => Response;

function installFetch() {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const request = input as Request;
    if (request.url.startsWith(`${VERIFY_URL}/resend`)) {
      return jsonResponse(200, { status: 200 });
    }
    if (request.url.startsWith(VERIFY_URL)) {
      return verifyResponse();
    }
    return jsonResponse(404, {});
  }) as typeof fetch;
}

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return render(
    <PhoneVerifyDialog phone='+1 555 555 5555' onOpenChange={vi.fn()} />,
    { wrapper: Wrapper }
  );
}

async function submitCode(user: ReturnType<typeof userEvent.setup>) {
  const otpInput = screen.getByLabelText('SMS verification code');
  await user.type(otpInput, '12345678');
  await user.click(screen.getByRole('button', { name: 'Verify' }));
}

describe('PhoneVerifyDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFetch();
  });

  it('verifies the code and closes on success', async () => {
    const user = userEvent.setup();
    verifyResponse = () => jsonResponse(200, { status: 200 });
    renderDialog();

    await submitCode(user);

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('+1 555 555 5555 verified.')
    );
  });

  it('disables the input after 3 failed attempts until a resend', async () => {
    const user = userEvent.setup();
    verifyResponse = INCORRECT_CODE;
    renderDialog();

    await submitCode(user);
    expect(
      await screen.findByText('Incorrect code. 2 attempts left.')
    ).toBeInTheDocument();

    await submitCode(user);
    await submitCode(user);
    expect(
      await screen.findByText(
        'Incorrect code. No attempts left — request a new code.'
      )
    ).toBeInTheDocument();

    // Input + submit disabled once attempts are exhausted.
    expect(screen.getByLabelText('SMS verification code')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();

    // Resending a code resets the attempt counter.
    await user.click(screen.getByRole('button', { name: 'Resend code' }));
    await waitFor(() =>
      expect(screen.getByLabelText('SMS verification code')).not.toBeDisabled()
    );
  });
});
