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
  audience: 'https://example.com',
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

  it('shows empty state text and Configure button', () => {
    render(<ServiceAccountCard />);
    expect(
      screen.getByText(/No service account configured/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /configure/i })
    ).toBeInTheDocument();
  });

  it('opens the configure dialog when Configure is clicked', async () => {
    render(<ServiceAccountCard />);
    const btn = screen.getByTestId('configure-service-account-button');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(
        screen.getByText(/Configure service account/i)
      ).toBeInTheDocument();
    });
  });

  it('calls saveServiceAccount (create path — no existingId) on form submit', async () => {
    const mockSave = vi.fn().mockResolvedValue({});
    vi.mocked(useUpsertServiceAccount).mockReturnValue(
      makeUpsertMock({ saveServiceAccount: mockSave })
    );

    render(<ServiceAccountCard />);

    // Open dialog
    fireEvent.click(screen.getByTestId('configure-service-account-button'));

    await waitFor(() => {
      expect(screen.getByTestId('service-account-email')).toBeInTheDocument();
    });

    // Fill form
    fireEvent.change(screen.getByTestId('service-account-email'), {
      target: { value: 'test@project.iam.gserviceaccount.com' },
    });
    fireEvent.change(screen.getByTestId('service-account-audience'), {
      target: { value: 'https://example.com' },
    });
    fireEvent.change(screen.getByTestId('service-account-public-key'), {
      target: { value: '-----BEGIN CERTIFICATE-----' },
    });
    fireEvent.change(screen.getByTestId('service-account-private-key-id'), {
      target: { value: 'key-id-123' },
    });
    fireEvent.change(screen.getByTestId('service-account-private-key'), {
      target: { value: '-----BEGIN RSA PRIVATE KEY-----' },
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
          audience: 'https://example.com',
          public_key: '-----BEGIN CERTIFICATE-----',
          private_key_id: 'key-id-123',
          private_key: '-----BEGIN RSA PRIVATE KEY-----',
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

  it('shows email, audience, Configured badge, and action buttons', () => {
    render(<ServiceAccountCard />);
    expect(screen.getByText(mockServiceAccount.email)).toBeInTheDocument();
    expect(screen.getByText(mockServiceAccount.audience)).toBeInTheDocument();
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
    fireEvent.change(screen.getByTestId('service-account-audience'), {
      target: { value: 'https://example.com' },
    });
    fireEvent.change(screen.getByTestId('service-account-public-key'), {
      target: { value: '-----BEGIN CERTIFICATE-----' },
    });
    fireEvent.change(screen.getByTestId('service-account-private-key-id'), {
      target: { value: 'new-key-id' },
    });
    fireEvent.change(screen.getByTestId('service-account-private-key'), {
      target: { value: '-----BEGIN RSA PRIVATE KEY-----' },
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

    // Close the dialog (cancel)
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

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
    fireEvent.change(screen.getByTestId('service-account-audience'), {
      target: { value: 'https://example.com' },
    });
    fireEvent.change(screen.getByTestId('service-account-public-key'), {
      target: { value: '-----BEGIN CERTIFICATE-----' },
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
