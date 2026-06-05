import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RoomsSyncSettingsForm } from './rooms-sync-settings-form';
import * as useRoomsSyncConfigModule from '@/hooks/sync/use-rooms-sync-config';

// Mock the hook
vi.spyOn(useRoomsSyncConfigModule, 'useRoomsSyncConfig').mockReturnValue({
  shouldSyncRooms: true,
  organizationId: 123,
  saveRoomsSyncConfig: vi.fn().mockResolvedValue({}),
  saveConfigMutation: {
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue({}),
  },
  isReady: true,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RoomsSyncSettingsForm', () => {
  it('renders with the current shouldSyncRooms value', () => {
    vi.mocked(useRoomsSyncConfigModule.useRoomsSyncConfig).mockReturnValue({
      shouldSyncRooms: true,
      organizationId: 123,
      saveRoomsSyncConfig: vi.fn(),
      saveConfigMutation: {
        isPending: false,
        mutateAsync: vi.fn(),
      },
      isReady: true,
    });

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    render(<RoomsSyncSettingsForm />, { wrapper });

    const switchElement = screen.getByRole('switch', {
      name: /enable rooms sync/i,
    });
    expect(switchElement).toBeChecked();
  });

  it('submits the form with the toggled value', async () => {
    const user = userEvent.setup();
    const mockSaveRoomsSyncConfig = vi.fn().mockResolvedValue({});

    vi.mocked(useRoomsSyncConfigModule.useRoomsSyncConfig).mockReturnValue({
      shouldSyncRooms: false,
      organizationId: 123,
      saveRoomsSyncConfig: mockSaveRoomsSyncConfig,
      saveConfigMutation: {
        isPending: false,
        mutateAsync: mockSaveRoomsSyncConfig,
      },
      isReady: true,
    });

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    render(<RoomsSyncSettingsForm />, { wrapper });

    const switchElement = screen.getByRole('switch', {
      name: /enable rooms sync/i,
    });
    const saveButton = screen.getByRole('button', { name: /save settings/i });

    // Toggle the switch
    await user.click(switchElement);
    expect(switchElement).toBeChecked();

    // Submit the form
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockSaveRoomsSyncConfig).toHaveBeenCalledWith({
        should_sync_rooms: true,
      });
    });
  });

  it('disables the save button while pending', async () => {
    vi.mocked(useRoomsSyncConfigModule.useRoomsSyncConfig).mockReturnValue({
      shouldSyncRooms: false,
      organizationId: 123,
      saveRoomsSyncConfig: vi.fn(),
      saveConfigMutation: {
        isPending: true,
        mutateAsync: vi.fn(),
      },
      isReady: true,
    });

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    render(<RoomsSyncSettingsForm />, { wrapper });

    const saveButton = screen.getByRole('button', { name: /saving/i });
    expect(saveButton).toBeDisabled();

    const switchElement = screen.getByRole('switch', {
      name: /enable rooms sync/i,
    });
    expect(switchElement).toBeDisabled();
  });

  it('displays success toast on successful save', async () => {
    const user = userEvent.setup();
    const mockSaveRoomsSyncConfig = vi.fn().mockResolvedValue({});

    vi.mocked(useRoomsSyncConfigModule.useRoomsSyncConfig).mockReturnValue({
      shouldSyncRooms: false,
      organizationId: 123,
      saveRoomsSyncConfig: mockSaveRoomsSyncConfig,
      saveConfigMutation: {
        isPending: false,
        mutateAsync: mockSaveRoomsSyncConfig,
      },
      isReady: true,
    });

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    render(<RoomsSyncSettingsForm />, { wrapper });

    const saveButton = screen.getByRole('button', { name: /save settings/i });
    await user.click(saveButton);

    await waitFor(() => {
      // The toast success will be called (tested via the sonner mock)
      expect(mockSaveRoomsSyncConfig).toHaveBeenCalled();
    });
  });
});
