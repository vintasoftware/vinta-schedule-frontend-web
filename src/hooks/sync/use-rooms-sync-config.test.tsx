import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRoomsSyncConfig } from './use-rooms-sync-config';
import * as currentOrgModule from '@/hooks/organizations/use-current-organization';
import * as tanstackModule from '@/client/@tanstack/react-query.gen';

// Partial mocks cast to the real return/param types so `tsc` + eslint are happy
// without restating the full generated shapes.
type CurrentOrgReturn = ReturnType<
  typeof currentOrgModule.useCurrentOrganization
>;
type PartialUpdateMutation =
  typeof tanstackModule.organizationsPartialUpdateMutation;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useRoomsSyncConfig', () => {
  it('reads shouldSyncRooms from the current organization', () => {
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
    } as unknown as CurrentOrgReturn);

    const mockMutationFn = vi.fn().mockReturnValue({
      mutateAsync: vi.fn(),
    });
    vi.spyOn(
      tanstackModule,
      'organizationsPartialUpdateMutation'
    ).mockImplementation(mockMutationFn as unknown as PartialUpdateMutation);

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
    vi.spyOn(currentOrgModule, 'useCurrentOrganization').mockReturnValue({
      isOnboarded: false,
      organization: null,
      membership: null,
    } as unknown as CurrentOrgReturn);

    const mockMutationFn = vi.fn().mockReturnValue({
      mutateAsync: vi.fn(),
    });
    vi.spyOn(
      tanstackModule,
      'organizationsPartialUpdateMutation'
    ).mockImplementation(mockMutationFn as unknown as PartialUpdateMutation);

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
