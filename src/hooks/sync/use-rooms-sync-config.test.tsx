import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRoomsSyncConfig } from './use-rooms-sync-config';
import * as currentOrgModule from '@/hooks/organizations/use-current-organization';
import * as tanstackModule from '@/client/@tanstack/react-query.gen';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRoomsSyncConfig', () => {
  it('reads shouldSyncRooms from the current organization', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(currentOrgModule, 'useCurrentOrganization').mockReturnValue({
      isOnboarded: true,
      organization: {
        id: 123,
        name: 'Test Org',
        should_sync_rooms: true,
      },
      membership: {
        organization: {
          id: 123,
          name: 'Test Org',
          should_sync_rooms: true,
        },
      },
    } as any);

    const mockMutationFn = vi.fn().mockReturnValue({
      mutateAsync: vi.fn(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(
      tanstackModule,
      'organizationsPartialUpdateMutation'
    ).mockImplementation(mockMutationFn as any);

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRoomsSyncConfig(), { wrapper });

    expect(result.current.shouldSyncRooms).toBe(true);
    expect(result.current.organizationId).toBe(123);
    expect(result.current.isReady).toBe(true);
  });

  it('throws error when organization is not loaded', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(currentOrgModule, 'useCurrentOrganization').mockReturnValue({
      isOnboarded: false,
      organization: null,
      membership: null,
    } as any);

    const mockMutationFn = vi.fn().mockReturnValue({
      mutateAsync: vi.fn(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(
      tanstackModule,
      'organizationsPartialUpdateMutation'
    ).mockImplementation(mockMutationFn as any);

    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRoomsSyncConfig(), { wrapper });

    expect(result.current.isReady).toBe(false);

    // Try to save when org is not ready
    await expect(
      result.current.saveRoomsSyncConfig({ should_sync_rooms: true })
    ).rejects.toThrow('Organization not loaded');
  });
});
