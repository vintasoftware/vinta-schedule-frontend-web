import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { useTriggerRoomsSync } from './use-trigger-rooms-sync';
import * as orgHook from '@/hooks/organizations/use-current-organization';
import * as sdk from '@/client/sdk.gen';

// Mock the modules
vi.mock('@/hooks/organizations/use-current-organization');
vi.mock('@/client/sdk.gen');

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createQueryClient();
  return React.createElement(
    QueryClientProvider,
    { client: queryClient },
    children
  );
};

describe('useTriggerRoomsSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call organizationsSyncRoomsCreate with org id and name body', async () => {
    const mockOrganization = {
      id: 42,
      name: 'Test Org',
      should_sync_rooms: true,
    };

    vi.mocked(orgHook.useCurrentOrganization).mockReturnValue({
      organization: mockOrganization,
      isOnboarded: true,
      isGated: false,
      isDisabled: false,
      membership: null,
      role: null,
      query: { data: undefined },
    } as unknown as ReturnType<typeof orgHook.useCurrentOrganization>);

    const mockSyncCreate = vi.fn().mockResolvedValue({ id: 1 });
    vi.mocked(sdk.organizationsSyncRoomsCreate).mockImplementation(
      mockSyncCreate as unknown as typeof sdk.organizationsSyncRoomsCreate
    );

    const { result } = renderHook(() => useTriggerRoomsSync(), { wrapper });

    await waitFor(() => {
      expect(result.current.triggerRoomsSync).toBeDefined();
    });

    await result.current.triggerRoomsSync();

    expect(mockSyncCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: '42' },
        body: {
          name: 'Test Org',
        },
      })
    );
  });

  it('should throw if organization is not loaded', async () => {
    vi.mocked(orgHook.useCurrentOrganization).mockReturnValue({
      organization: null,
      isOnboarded: false,
      isGated: false,
      isDisabled: false,
      membership: null,
      role: null,
      query: { data: undefined },
    } as unknown as ReturnType<typeof orgHook.useCurrentOrganization>);

    const { result } = renderHook(() => useTriggerRoomsSync(), { wrapper });

    await expect(result.current.triggerRoomsSync()).rejects.toThrow(
      'Organization not loaded'
    );
  });

  it('should throw if organization name is not available', async () => {
    const mockOrganization = {
      id: 42,
      name: '',
      should_sync_rooms: true,
    };

    vi.mocked(orgHook.useCurrentOrganization).mockReturnValue({
      organization: mockOrganization,
      isOnboarded: true,
      isGated: false,
      isDisabled: false,
      membership: null,
      role: null,
      query: { data: undefined },
    } as unknown as ReturnType<typeof orgHook.useCurrentOrganization>);

    const { result } = renderHook(() => useTriggerRoomsSync(), { wrapper });

    await expect(result.current.triggerRoomsSync()).rejects.toThrow(
      'Organization name not available'
    );
  });

  it('should only call the mutation once (no cache invalidation)', async () => {
    const mockOrganization = {
      id: 42,
      name: 'Test Org',
      should_sync_rooms: true,
    };

    vi.mocked(orgHook.useCurrentOrganization).mockReturnValue({
      organization: mockOrganization,
      isOnboarded: true,
      isGated: false,
      isDisabled: false,
      membership: null,
      role: null,
      query: { data: undefined },
    } as unknown as ReturnType<typeof orgHook.useCurrentOrganization>);

    const mockSyncCreate = vi.fn().mockResolvedValue({ id: 1 });
    vi.mocked(sdk.organizationsSyncRoomsCreate).mockImplementation(
      mockSyncCreate as unknown as typeof sdk.organizationsSyncRoomsCreate
    );

    const { result } = renderHook(() => useTriggerRoomsSync(), { wrapper });

    await result.current.triggerRoomsSync();

    expect(mockSyncCreate).toHaveBeenCalledTimes(1);
  });
});
