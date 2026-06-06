import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { useTriggerOrgCalendarSync } from './use-trigger-org-calendar-sync';
import * as orgHook from '@/hooks/organizations/use-current-organization';
import * as sdk from '@/client/sdk.gen';
import { DateTime } from '@/lib/datetime';

// Mock the modules
vi.mock('@/hooks/organizations/use-current-organization');
vi.mock('@/client/sdk.gen');
vi.mock('@/lib/datetime');

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

describe('useTriggerOrgCalendarSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock DateTime.now() to return a fixed date for testing
    const mockNow = {
      minus: () => ({
        startOf: () => ({
          toISO: () => '2024-05-05T00:00:00+00:00',
        }),
      }),
      plus: () => ({
        endOf: () => ({
          toISO: () => '2024-09-05T23:59:59+00:00',
        }),
      }),
    };
    vi.mocked(DateTime.now).mockReturnValue(
      mockNow as unknown as ReturnType<typeof DateTime.now>
    );
  });

  it('should call organizationsSyncCalendarsCreate with org id and default window body', async () => {
    const mockOrganization = {
      id: 42,
      name: 'Test Org',
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
    vi.mocked(sdk.organizationsSyncCalendarsCreate).mockImplementation(
      mockSyncCreate as unknown as typeof sdk.organizationsSyncCalendarsCreate
    );

    const { result } = renderHook(() => useTriggerOrgCalendarSync(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.triggerOrgCalendarSync).toBeDefined();
    });

    await result.current.triggerOrgCalendarSync();

    expect(mockSyncCreate).toHaveBeenCalledTimes(1);
    expect(mockSyncCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: '42' },
        body: {
          start_datetime: '2024-05-05T00:00:00+00:00',
          end_datetime: '2024-09-05T23:59:59+00:00',
          should_update_events: true,
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

    const { result } = renderHook(() => useTriggerOrgCalendarSync(), {
      wrapper,
    });

    await expect(result.current.triggerOrgCalendarSync()).rejects.toThrow(
      'Organization not loaded'
    );
  });

  it('should only call the mutation once (no cache invalidation)', async () => {
    const mockOrganization = {
      id: 42,
      name: 'Test Org',
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
    vi.mocked(sdk.organizationsSyncCalendarsCreate).mockImplementation(
      mockSyncCreate as unknown as typeof sdk.organizationsSyncCalendarsCreate
    );

    const { result } = renderHook(() => useTriggerOrgCalendarSync(), {
      wrapper,
    });

    await result.current.triggerOrgCalendarSync();

    expect(mockSyncCreate).toHaveBeenCalledTimes(1);
  });
});
