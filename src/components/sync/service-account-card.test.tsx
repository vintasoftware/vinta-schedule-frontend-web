import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from '@testing-library/react';
import { ServiceAccountCard } from './service-account-card';
import type { ServiceAccountRead } from '@/client';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the hooks
vi.mock('@/hooks/service-accounts/use-service-account');

import {
  useServiceAccount,
  useUpsertServiceAccount,
  useDeleteServiceAccount,
} from '@/hooks/service-accounts/use-service-account';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockServiceAccount: ServiceAccountRead = {
  id: 1,
  email: 'my-sa@project.iam.gserviceaccount.com',
  admin_email: 'admin@example.com',
  configured: true,
  created: '2024-01-15T00:00:00Z',
  modified: '2024-06-15T00:00:00Z',
};

function makeUpsertMock(
  overrides?: Partial<ReturnType<typeof useUpsertServiceAccount>>
) {
  return {
    saveServiceAccount: vi.fn().mockResolvedValue({}),
    createMutation: { isPending: false },
    patchMutation: { isPending: false },
    isPending: false,
    ...overrides,
  } as unknown as ReturnType<typeof useUpsertServiceAccount>;
}

function makeDeleteMock(
  overrides?: Partial<ReturnType<typeof useDeleteServiceAccount>>
) {
  return {
    deleteServiceAccount: vi.fn().mockResolvedValue({}),
    deleteMutation: { isPending: false },
    ...overrides,
  } as unknown as ReturnType<typeof useDeleteServiceAccount>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ServiceAccountCard — not configured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useServiceAccount).mockReturnValue({
      serviceAccount: null,
      isConfigured: false,
      isLoading: false,
      isError: false,
      query: {} as unknown as ReturnType<typeof useServiceAccount>['query'],
    });
    vi.mocked(useUpsertServiceAccount).mockReturnValue(makeUpsertMock());
    vi.mocked(useDeleteServiceAccount).mockReturnValue(makeDeleteMock());
  });

  it('shows empty state text and set-up button', () => {
    render(<ServiceAccountCard />);
    expect(
      screen.getByText(/No service account configured/i)
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('configure-service-account-button')
    ).toBeInTheDocument();
  });

  it('opens the setup wizard on the first instruction step when set-up is clicked', async () => {
    render(<ServiceAccountCard />);
    const btn = screen.getByTestId('configure-service-account-button');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByText(/Create a service account/i)).toBeInTheDocument();
    });
    // The form is not shown until the operator advances through the steps.
    expect(
      screen.queryByTestId('service-account-email')
    ).not.toBeInTheDocument();
  });

  it('calls saveServiceAccount (create path — no existingId) after walking the wizard to the form', async () => {
    const mockSave = vi.fn().mockResolvedValue({});
    vi.mocked(useUpsertServiceAccount).mockReturnValue(
      makeUpsertMock({ saveServiceAccount: mockSave })
    );

    render(<ServiceAccountCard />);

    // Open wizard
    fireEvent.click(screen.getByTestId('configure-service-account-button'));

    // Advance through the four instruction steps to reach the form.
    for (let i = 0; i < 4; i++) {
      await waitFor(() => {
        expect(screen.getByTestId('wizard-next')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('wizard-next'));
    }

    await waitFor(() => {
      expect(screen.getByTestId('service-account-email')).toBeInTheDocument();
    });

    // Fill form
    fireEvent.change(screen.getByTestId('service-account-email'), {
      target: { value: 'test@project.iam.gserviceaccount.com' },
    });
    fireEvent.change(screen.getByTestId('service-account-admin-email'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByTestId('service-account-private-key-id'), {
      target: { value: 'key-id-123' },
    });
    fireEvent.change(screen.getByTestId('service-account-private-key'), {
      target: { value: '-----BEGIN PRIVATE KEY-----' },
    });

    // Submit
    await act(async () => {
      fireEvent.click(screen.getByTestId('save-service-account-submit'));
    });

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@project.iam.gserviceaccount.com',
          admin_email: 'admin@example.com',
          private_key_id: 'key-id-123',
          private_key: '-----BEGIN PRIVATE KEY-----',
        }),
        undefined // no existingId in create path
      );
    });
  });
});

describe('ServiceAccountCard — configured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useServiceAccount).mockReturnValue({
      serviceAccount: mockServiceAccount,
      isConfigured: true,
      isLoading: false,
      isError: false,
      query: {} as unknown as ReturnType<typeof useServiceAccount>['query'],
    });
    vi.mocked(useUpsertServiceAccount).mockReturnValue(makeUpsertMock());
    vi.mocked(useDeleteServiceAccount).mockReturnValue(makeDeleteMock());
  });

  it('shows email, admin_email, Configured badge, and action buttons', () => {
    render(<ServiceAccountCard />);
    expect(screen.getByText(mockServiceAccount.email)).toBeInTheDocument();
    expect(
      screen.getByText(mockServiceAccount.admin_email)
    ).toBeInTheDocument();
    expect(screen.getByText('Configured')).toBeInTheDocument();
    expect(
      screen.getByTestId('rotate-service-account-button')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('remove-service-account-button')
    ).toBeInTheDocument();
  });

  it('calls saveServiceAccount (rotate path — existingId provided) on form submit', async () => {
    const mockSave = vi.fn().mockResolvedValue({});
    vi.mocked(useUpsertServiceAccount).mockReturnValue(
      makeUpsertMock({ saveServiceAccount: mockSave })
    );

    render(<ServiceAccountCard />);

    // Open the rotate dialog
    fireEvent.click(screen.getByTestId('rotate-service-account-button'));

    await waitFor(() => {
      expect(
        screen.getByText(/Rotate service account credentials/i)
      ).toBeInTheDocument();
    });

    // All credential fields should be EMPTY (never pre-populated)
    expect(screen.getByTestId('service-account-email')).toHaveValue('');
    expect(screen.getByTestId('service-account-private-key')).toHaveValue('');

    // Fill form with fresh credentials
    fireEvent.change(screen.getByTestId('service-account-email'), {
      target: { value: 'rotated@project.iam.gserviceaccount.com' },
    });
    fireEvent.change(screen.getByTestId('service-account-admin-email'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByTestId('service-account-private-key-id'), {
      target: { value: 'new-key-id' },
    });
    fireEvent.change(screen.getByTestId('service-account-private-key'), {
      target: { value: '-----BEGIN PRIVATE KEY-----' },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-service-account-submit'));
    });

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'rotated@project.iam.gserviceaccount.com',
          private_key_id: 'new-key-id',
        }),
        1 // existingId from mockServiceAccount.id
      );
    });
  });

  it('clears form credentials after dialog closes (open→false→true shows empty inputs)', async () => {
    render(<ServiceAccountCard />);

    // Open dialog
    fireEvent.click(screen.getByTestId('rotate-service-account-button'));

    await waitFor(() => {
      expect(
        screen.getByTestId('service-account-private-key')
      ).toBeInTheDocument();
    });

    // Enter a private key
    fireEvent.change(screen.getByTestId('service-account-private-key'), {
      target: { value: 'super-secret-key' },
    });
    expect(screen.getByTestId('service-account-private-key')).toHaveValue(
      'super-secret-key'
    );

    // Close the dialog (the built-in close button)
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(
        screen.queryByTestId('service-account-private-key')
      ).not.toBeInTheDocument();
    });

    // Reopen the dialog — credentials must be cleared
    fireEvent.click(screen.getByTestId('rotate-service-account-button'));

    await waitFor(() => {
      expect(
        screen.getByTestId('service-account-private-key')
      ).toBeInTheDocument();
    });

    expect(screen.getByTestId('service-account-private-key')).toHaveValue('');
  });

  it('does NOT console.log the private_key at any point', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const consoleErrorSpy = vi.spyOn(console, 'error');
    const consoleWarnSpy = vi.spyOn(console, 'warn');

    const privateKey = 'ULTRA-SECRET-PRIVATE-KEY';
    const mockSave = vi.fn().mockResolvedValue({});
    vi.mocked(useUpsertServiceAccount).mockReturnValue(
      makeUpsertMock({ saveServiceAccount: mockSave })
    );

    render(<ServiceAccountCard />);

    // Open dialog
    fireEvent.click(screen.getByTestId('rotate-service-account-button'));
    await waitFor(() => {
      expect(
        screen.getByTestId('service-account-private-key')
      ).toBeInTheDocument();
    });

    // Fill all required fields
    fireEvent.change(screen.getByTestId('service-account-email'), {
      target: { value: 'test@project.iam.gserviceaccount.com' },
    });
    fireEvent.change(screen.getByTestId('service-account-admin-email'), {
      target: { value: 'admin@example.com' },
    });
    fireEvent.change(screen.getByTestId('service-account-private-key-id'), {
      target: { value: 'key-id' },
    });
    fireEvent.change(screen.getByTestId('service-account-private-key'), {
      target: { value: privateKey },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('save-service-account-submit'));
    });

    // Verify no console calls were made with the private key
    const allLogCalls = [
      ...consoleSpy.mock.calls.flat(),
      ...consoleErrorSpy.mock.calls.flat(),
      ...consoleWarnSpy.mock.calls.flat(),
    ]
      .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
      .join(' ');

    expect(allLogCalls).not.toContain(privateKey);

    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('shows remove confirm dialog and calls deleteServiceAccount on confirm', async () => {
    const mockDelete = vi.fn().mockResolvedValue({});
    vi.mocked(useDeleteServiceAccount).mockReturnValue(
      makeDeleteMock({ deleteServiceAccount: mockDelete })
    );

    render(<ServiceAccountCard />);

    // Click remove button
    fireEvent.click(screen.getByTestId('remove-service-account-button'));

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    // Confirm deletion
    const dialog = screen.getByRole('alertdialog');
    const confirmBtn = within(dialog).getByTestId(
      'confirm-remove-service-account'
    );
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockDelete).toHaveBeenCalledWith(mockServiceAccount.id);
    });

    expect(toast.success).toHaveBeenCalledWith('Service account removed');
  });

  it('does NOT call deleteServiceAccount when cancel is clicked in the confirm dialog', async () => {
    const mockDelete = vi.fn().mockResolvedValue({});
    vi.mocked(useDeleteServiceAccount).mockReturnValue(
      makeDeleteMock({ deleteServiceAccount: mockDelete })
    );

    render(<ServiceAccountCard />);

    // Click remove button
    fireEvent.click(screen.getByTestId('remove-service-account-button'));

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    // Cancel
    const dialog = screen.getByRole('alertdialog');
    const cancelBtn = within(dialog).getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    expect(mockDelete).not.toHaveBeenCalled();
  });
});
