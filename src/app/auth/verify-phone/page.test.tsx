/**
 * VerifyPhonePage tests (SMS MFA Consent Frontend — Phase 8).
 *
 * Covers the `403 consent_required` recovery path on both the verify
 * submission and the "Resend Code" action:
 * - A consent_required error records `sms_consent` for the account phone via
 *   `useCreateConsent`, then retries the original request ONCE; success
 *   after the retry shows the normal success UI.
 * - A non-consent error leaves the existing error/resendMessage behavior
 *   untouched — `createConsent` is never called.
 * - If the retried request ALSO fails (including with consent_required
 *   again), the page does not retry a second time and falls through to the
 *   normal error state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Mocks — declared before module imports
// ---------------------------------------------------------------------------

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('@/lib/session-token', () => ({
  syncSessionTokenFromCookie: vi.fn(),
}));

const mockAuthenticationFlowControl = vi.fn();
vi.mock('@/hooks/authentication/use-authentication-flow-control', () => ({
  useAuthenticationFlowControl: () => mockAuthenticationFlowControl,
}));

const mockVerifyPhone = vi.fn();
vi.mock('@/hooks/authentication/use-verify-phone', () => ({
  useVerifyPhone: () => ({
    verifyPhone: mockVerifyPhone,
    verifyPhoneMutation: { isPending: false },
  }),
}));

const mockResendPhoneVerificationCode = vi.fn();
vi.mock('@/hooks/authentication/use-resend-phone-verification-code', () => ({
  useResendPhoneVerificationCode: () => ({
    resendPhoneVerificationCode: mockResendPhoneVerificationCode,
    resendPhoneVerificationCodeMutation: { isPending: false },
  }),
}));

const mockCreateConsent = vi.fn();
vi.mock('@/hooks/consents/use-create-consent', () => ({
  useCreateConsent: () => ({
    createConsent: mockCreateConsent,
    createConsentMutation: { isPending: false },
  }),
}));

let mockAccountPhone: { phone?: string } | undefined = {
  phone: '+15551234567',
};
let mockAccountPhoneIsLoading = false;
vi.mock('@/hooks/authentication/use-account-phone', () => ({
  useAccountPhone: () => ({
    phone: mockAccountPhone,
    isLoading: mockAccountPhoneIsLoading,
    isError: false,
  }),
}));

import VerifyPhonePage from './page';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CONSENT_REQUIRED_ERROR = {
  status: 403,
  errors: [
    {
      code: 'consent_required',
      message:
        'SMS consent is required before a verification code can be sent.',
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return render(<VerifyPhonePage />, { wrapper: Wrapper });
}

async function typeOtp(user: ReturnType<typeof userEvent.setup>) {
  const otpInput = screen.getByRole('textbox');
  await user.type(otpInput, '12345678');
}

describe('VerifyPhonePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountPhone = { phone: '+15551234567' };
    mockAccountPhoneIsLoading = false;
  });

  // -------------------------------------------------------------------------
  // Resend Code — consent_required recovery
  // -------------------------------------------------------------------------

  it('resend: on 403 consent_required, records sms_consent for the account phone then retries and shows success', async () => {
    mockResendPhoneVerificationCode
      .mockRejectedValueOnce(CONSENT_REQUIRED_ERROR)
      .mockResolvedValueOnce({ status: 200 });
    mockCreateConsent.mockResolvedValue({ id: 1 });

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Resend Code' }));

    await waitFor(() =>
      expect(
        screen.getByText('Verification code resent to your phone.')
      ).toBeInTheDocument()
    );

    expect(mockCreateConsent).toHaveBeenCalledWith({
      document_type: 'sms_consent',
      phone_number: '+15551234567',
    });
    expect(mockResendPhoneVerificationCode).toHaveBeenCalledTimes(2);
  });

  it('resend: a NON-consent error does not call createConsent and shows the existing error message', async () => {
    mockResendPhoneVerificationCode.mockRejectedValue(
      new Error('Too many requests')
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Resend Code' }));

    expect(await screen.findByText('Too many requests')).toBeInTheDocument();
    expect(mockCreateConsent).not.toHaveBeenCalled();
    expect(mockResendPhoneVerificationCode).toHaveBeenCalledTimes(1);
  });

  it('resend: retry-once guard — a consent_required retry failure again does not loop and ends in the error state', async () => {
    mockResendPhoneVerificationCode
      .mockRejectedValueOnce(CONSENT_REQUIRED_ERROR)
      .mockRejectedValueOnce(CONSENT_REQUIRED_ERROR);
    mockCreateConsent.mockResolvedValue({ id: 1 });

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Resend Code' }));

    await waitFor(() =>
      expect(mockResendPhoneVerificationCode).toHaveBeenCalledTimes(2)
    );
    // Only one consent recording + one retry attempt — no further looping.
    expect(mockCreateConsent).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText('Verification code resent to your phone.')
    ).not.toBeInTheDocument();
    expect(
      await screen.findByText('Failed to resend code')
    ).toBeInTheDocument();
  });

  it('resend: with no account phone available, shows a clear recovery-failure message and does not call createConsent', async () => {
    mockAccountPhone = undefined;
    mockResendPhoneVerificationCode.mockRejectedValueOnce(
      CONSENT_REQUIRED_ERROR
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Resend Code' }));

    expect(
      await screen.findByText(/re-initiate phone setup/i)
    ).toBeInTheDocument();
    expect(mockCreateConsent).not.toHaveBeenCalled();
    expect(mockResendPhoneVerificationCode).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Verify submit — consent_required recovery
  // -------------------------------------------------------------------------

  it('verify: on 403 consent_required, records sms_consent then retries verify once and continues the flow on success', async () => {
    const authenticatedResponse = { status: 200, data: { user: { id: 1 } } };
    mockVerifyPhone
      .mockRejectedValueOnce(CONSENT_REQUIRED_ERROR)
      .mockResolvedValueOnce(authenticatedResponse);
    mockCreateConsent.mockResolvedValue({ id: 1 });

    const user = userEvent.setup();
    renderPage();

    await typeOtp(user);
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() =>
      expect(mockAuthenticationFlowControl).toHaveBeenCalledWith(
        authenticatedResponse
      )
    );

    expect(mockCreateConsent).toHaveBeenCalledWith({
      document_type: 'sms_consent',
      phone_number: '+15551234567',
    });
    expect(mockVerifyPhone).toHaveBeenCalledTimes(2);
    expect(mockVerifyPhone).toHaveBeenNthCalledWith(1, { code: '12345678' });
    expect(mockVerifyPhone).toHaveBeenNthCalledWith(2, { code: '12345678' });
  });

  it('verify: a NON-consent error shows the normal error, calls authenticationFlowControl, and does not call createConsent', async () => {
    mockVerifyPhone.mockRejectedValue(new Error('Incorrect code.'));

    const user = userEvent.setup();
    renderPage();

    await typeOtp(user);
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByText('Incorrect code.')).toBeInTheDocument();
    expect(mockAuthenticationFlowControl).toHaveBeenCalledWith(
      new Error('Incorrect code.')
    );
    expect(mockCreateConsent).not.toHaveBeenCalled();
    expect(mockVerifyPhone).toHaveBeenCalledTimes(1);
  });

  it('verify: retry-once guard — a consent_required retry failure again does not loop and ends in the error state', async () => {
    mockVerifyPhone
      .mockRejectedValueOnce(CONSENT_REQUIRED_ERROR)
      .mockRejectedValueOnce(CONSENT_REQUIRED_ERROR);
    mockCreateConsent.mockResolvedValue({ id: 1 });

    const user = userEvent.setup();
    renderPage();

    await typeOtp(user);
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => expect(mockVerifyPhone).toHaveBeenCalledTimes(2));
    expect(mockCreateConsent).toHaveBeenCalledTimes(1);
    // "Verification failed" appears both as the alert title and (as the
    // fallback message for a non-Error rejection) the description.
    expect(await screen.findAllByText('Verification failed')).toHaveLength(2);
    // The final failure is still routed through authenticationFlowControl.
    expect(mockAuthenticationFlowControl).toHaveBeenCalledWith(
      CONSENT_REQUIRED_ERROR
    );
  });

  it('verify: with no account phone available (not loading), shows the missing-phone message and does NOT route the synthetic error through authenticationFlowControl', async () => {
    mockAccountPhone = undefined;
    mockAccountPhoneIsLoading = false;
    mockVerifyPhone.mockRejectedValueOnce(CONSENT_REQUIRED_ERROR);

    const user = userEvent.setup();
    renderPage();

    await typeOtp(user);
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(
      await screen.findByText(/re-initiate phone setup/i)
    ).toBeInTheDocument();
    expect(mockCreateConsent).not.toHaveBeenCalled();
    // Only the initial verify call — no retry attempted.
    expect(mockVerifyPhone).toHaveBeenCalledTimes(1);
    // This error never touched the API — it must not be routed through the
    // auth-flow controller.
    expect(mockAuthenticationFlowControl).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/phone/i) })
    );
    expect(mockAuthenticationFlowControl).not.toHaveBeenCalled();
  });

  it('verify: while the account phone is still loading, shows a softer loading message instead of the definitive missing-phone message', async () => {
    mockAccountPhone = undefined;
    mockAccountPhoneIsLoading = true;
    mockVerifyPhone.mockRejectedValueOnce(CONSENT_REQUIRED_ERROR);

    const user = userEvent.setup();
    renderPage();

    await typeOtp(user);
    await user.click(screen.getByRole('button', { name: 'Verify' }));

    expect(
      await screen.findByText(/still loading your account details/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/re-initiate phone setup/i)
    ).not.toBeInTheDocument();
    expect(mockCreateConsent).not.toHaveBeenCalled();
    expect(mockVerifyPhone).toHaveBeenCalledTimes(1);
    expect(mockAuthenticationFlowControl).not.toHaveBeenCalled();
  });
});
