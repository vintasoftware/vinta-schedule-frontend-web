import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { toast } from 'sonner';

import { PhoneSection } from './phone-section';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock('@/hooks/authentication/use-account-phone');
vi.mock('@/hooks/authentication/use-update-phone');
vi.mock('@/hooks/authentication/use-sensitive-action');
vi.mock('@/hooks/consents/use-create-consent');

import { useAccountPhone } from '@/hooks/authentication/use-account-phone';
import { useUpdatePhone } from '@/hooks/authentication/use-update-phone';
import { useSensitiveAction } from '@/hooks/authentication/use-sensitive-action';
import { useCreateConsent } from '@/hooks/consents/use-create-consent';

function mockNoPhone() {
  vi.mocked(useAccountPhone).mockReturnValue({
    phone: undefined,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useAccountPhone>);
}

function mockExistingPhone(phone: { phone: string; verified: boolean }) {
  vi.mocked(useAccountPhone).mockReturnValue({
    phone,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useAccountPhone>);
}

function mockSensitiveActionPassthrough() {
  vi.mocked(useSensitiveAction).mockReturnValue({
    runSensitive: async <T,>(action: () => Promise<T>) => action(),
    reauthenticationRequest: null,
  } as unknown as ReturnType<typeof useSensitiveAction>);
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
  return render(<PhoneSection />, { wrapper: Wrapper });
}

describe('PhoneSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNoPhone();
    mockSensitiveActionPassthrough();
  });

  it('records sms_consent for the new phone before requesting a verification code', async () => {
    const callOrder: string[] = [];

    const createConsent = vi.fn().mockImplementation(async (body) => {
      callOrder.push('createConsent');
      return { id: 1, ...body };
    });
    vi.mocked(useCreateConsent).mockReturnValue({
      createConsent,
      createConsentMutation: { isPending: false },
    } as unknown as ReturnType<typeof useCreateConsent>);

    const updatePhone = vi.fn().mockImplementation(async () => {
      callOrder.push('updatePhone');
      return { status: 200 };
    });
    vi.mocked(useUpdatePhone).mockReturnValue({
      updatePhone,
      updatePhoneMutation: { isPending: false },
    } as unknown as ReturnType<typeof useUpdatePhone>);

    const user = userEvent.setup();
    renderSection();

    await user.type(screen.getByLabelText('Phone number'), '+1 555 123 4567');
    await user.click(screen.getByRole('button', { name: 'Add phone' }));

    await waitFor(() => expect(updatePhone).toHaveBeenCalled());

    expect(createConsent).toHaveBeenCalledWith({
      document_type: 'sms_consent',
      phone_number: '+1 555 123 4567',
    });
    expect(updatePhone).toHaveBeenCalledWith('+1 555 123 4567');
    expect(callOrder).toEqual(['createConsent', 'updatePhone']);
  });

  it('does not request a verification code when consent recording fails (400)', async () => {
    const createConsent = vi
      .fn()
      .mockRejectedValue(new Error('Invalid document type'));
    vi.mocked(useCreateConsent).mockReturnValue({
      createConsent,
      createConsentMutation: { isPending: false },
    } as unknown as ReturnType<typeof useCreateConsent>);

    const updatePhone = vi.fn();
    vi.mocked(useUpdatePhone).mockReturnValue({
      updatePhone,
      updatePhoneMutation: { isPending: false },
    } as unknown as ReturnType<typeof useUpdatePhone>);

    const user = userEvent.setup();
    renderSection();

    await user.type(screen.getByLabelText('Phone number'), '+1 555 123 4567');
    await user.click(screen.getByRole('button', { name: 'Add phone' }));

    await waitFor(() => expect(createConsent).toHaveBeenCalled());

    expect(updatePhone).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "We couldn't record your SMS consent, so a verification code can't be sent right now. Please try again later."
    );
  });

  it('sends the verification code and confirms success once consent succeeds', async () => {
    const createConsent = vi.fn().mockResolvedValue({ id: 1 });
    vi.mocked(useCreateConsent).mockReturnValue({
      createConsent,
      createConsentMutation: { isPending: false },
    } as unknown as ReturnType<typeof useCreateConsent>);

    const updatePhone = vi.fn().mockResolvedValue({ status: 200 });
    vi.mocked(useUpdatePhone).mockReturnValue({
      updatePhone,
      updatePhoneMutation: { isPending: false },
    } as unknown as ReturnType<typeof useUpdatePhone>);

    const user = userEvent.setup();
    renderSection();

    await user.type(screen.getByLabelText('Phone number'), '+1 555 123 4567');
    await user.click(screen.getByRole('button', { name: 'Add phone' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Verification code sent to +1 555 123 4567.'
      )
    );
    expect(updatePhone).toHaveBeenCalledWith('+1 555 123 4567');
    // Verify dialog opens for the newly submitted phone.
    expect(
      screen.getByRole('heading', { name: 'Verify +1 555 123 4567' })
    ).toBeInTheDocument();
  });

  it('changes an existing phone: opens the form via Change, records consent for the new phone before updatePhone, and Cancel hides the form', async () => {
    mockExistingPhone({ phone: '+1 555 000 0000', verified: true });

    const callOrder: string[] = [];

    const createConsent = vi.fn().mockImplementation(async (body) => {
      callOrder.push('createConsent');
      return { id: 1, ...body };
    });
    vi.mocked(useCreateConsent).mockReturnValue({
      createConsent,
      createConsentMutation: { isPending: false },
    } as unknown as ReturnType<typeof useCreateConsent>);

    const updatePhone = vi.fn().mockImplementation(async () => {
      callOrder.push('updatePhone');
      return { status: 200 };
    });
    vi.mocked(useUpdatePhone).mockReturnValue({
      updatePhone,
      updatePhoneMutation: { isPending: false },
    } as unknown as ReturnType<typeof useUpdatePhone>);

    const user = userEvent.setup();
    renderSection();

    // The form is hidden behind the "Change" button until clicked.
    expect(screen.queryByLabelText('Phone number')).not.toBeInTheDocument();
    expect(screen.getByText('+1 555 000 0000')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change' }));

    expect(screen.getByLabelText('Phone number')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Phone number'), '+1 555 999 8888');
    await user.click(screen.getByRole('button', { name: 'Change' }));

    await waitFor(() => expect(updatePhone).toHaveBeenCalled());

    expect(createConsent).toHaveBeenCalledWith({
      document_type: 'sms_consent',
      phone_number: '+1 555 999 8888',
    });
    expect(updatePhone).toHaveBeenCalledWith('+1 555 999 8888');
    expect(callOrder).toEqual(['createConsent', 'updatePhone']);

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Verification code sent to +1 555 999 8888.'
      )
    );
  });

  it('resets and hides the form when Cancel is clicked', async () => {
    mockExistingPhone({ phone: '+1 555 000 0000', verified: false });
    vi.mocked(useCreateConsent).mockReturnValue({
      createConsent: vi.fn(),
      createConsentMutation: { isPending: false },
    } as unknown as ReturnType<typeof useCreateConsent>);
    vi.mocked(useUpdatePhone).mockReturnValue({
      updatePhone: vi.fn(),
      updatePhoneMutation: { isPending: false },
    } as unknown as ReturnType<typeof useUpdatePhone>);

    const user = userEvent.setup();
    renderSection();

    await user.click(screen.getByRole('button', { name: 'Change' }));
    await user.type(screen.getByLabelText('Phone number'), '+1 555 999 8888');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Phone number')).not.toBeInTheDocument();
    expect(screen.getByText('+1 555 000 0000')).toBeInTheDocument();
  });

  it('shows an inline SMS-consent acknowledgement near the phone form', () => {
    vi.mocked(useCreateConsent).mockReturnValue({
      createConsent: vi.fn(),
      createConsentMutation: { isPending: false },
    } as unknown as ReturnType<typeof useCreateConsent>);
    vi.mocked(useUpdatePhone).mockReturnValue({
      updatePhone: vi.fn(),
      updatePhoneMutation: { isPending: false },
    } as unknown as ReturnType<typeof useUpdatePhone>);

    renderSection();

    expect(
      screen.getByText(/agree to receive SMS verification codes/i)
    ).toBeInTheDocument();
  });
});
