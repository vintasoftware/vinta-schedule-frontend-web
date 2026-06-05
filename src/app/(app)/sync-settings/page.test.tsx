import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SyncSettingsPage from './page';
import * as roleGateModule from '@/components/navigation/role-gate';

// Mock useRequireRole
vi.spyOn(roleGateModule, 'useRequireRole').mockImplementation(() => ({
  isAllowed: true,
}));

// Mock the form and button components
vi.mock('@/components/sync/rooms-sync-settings-form', () => ({
  RoomsSyncSettingsForm: () => <div data-testid='rooms-sync-form'>Form</div>,
}));

vi.mock('@/components/sync/trigger-rooms-sync-button', () => ({
  TriggerRoomsSyncButton: () => (
    <div data-testid='trigger-rooms-sync-button'>Sync Button</div>
  ),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('SyncSettingsPage', () => {
  it('renders the page when user is admin', () => {
    vi.mocked(roleGateModule.useRequireRole).mockReturnValue({
      isAllowed: true,
    });

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    render(<SyncSettingsPage />, { wrapper });

    expect(screen.getByText('Sync settings')).toBeInTheDocument();
    expect(
      screen.getByText('Configure synchronization for your organization.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('rooms-sync-form')).toBeInTheDocument();
    expect(screen.getByTestId('trigger-rooms-sync-button')).toBeInTheDocument();
  });

  it('returns null when user is not admin', () => {
    vi.mocked(roleGateModule.useRequireRole).mockReturnValue({
      isAllowed: false,
    });

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { container } = render(<SyncSettingsPage />, { wrapper });

    // Page should render nothing (null) for non-admins
    expect(container.innerHTML).toBe('');
  });
});
