import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { useTriggerUserCalendarSync } from './use-trigger-user-calendar-sync';
import * as sdk from '@/client/sdk.gen';
import { DateTime } from '@/lib/datetime';

// Mock the modules
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

describe('useTriggerUserCalendarSync', () => {
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

  it('should call calendarAdminSyncCreate with calendar id and default window body', async () => {
    const mockAdminSyncCreate = vi.fn().mockResolvedValue({ id: 1 });
    vi.mocked(sdk.calendarAdminSyncCreate).mockImplementation(
      mockAdminSyncCreate as unknown as typeof sdk.calendarAdminSyncCreate
    );

    const { result } = renderHook(() => useTriggerUserCalendarSync(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.triggerUserCalendarSync).toBeDefined();
    });

    await result.current.triggerUserCalendarSync(42);

    expect(mockAdminSyncCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { id: '42' },
        body: expect.objectContaining({
          start_datetime: '2024-05-05T00:00:00+00:00',
          end_datetime: '2024-09-05T23:59:59+00:00',
          should_update_events: true,
        }),
      })
    );
  });

  it('should only call the mutation once (no cache invalidation)', async () => {
    const mockAdminSyncCreate = vi.fn().mockResolvedValue({ id: 1 });
    vi.mocked(sdk.calendarAdminSyncCreate).mockImplementation(
      mockAdminSyncCreate as unknown as typeof sdk.calendarAdminSyncCreate
    );

    const { result } = renderHook(() => useTriggerUserCalendarSync(), {
      wrapper,
    });

    await result.current.triggerUserCalendarSync(42);

    expect(mockAdminSyncCreate).toHaveBeenCalledTimes(1);
  });

  it('should propagate errors from the API', async () => {
    const mockAdminSyncCreate = vi
      .fn()
      .mockRejectedValue(new Error('Admin sync failed'));
    vi.mocked(sdk.calendarAdminSyncCreate).mockImplementation(
      mockAdminSyncCreate as unknown as typeof sdk.calendarAdminSyncCreate
    );

    const { result } = renderHook(() => useTriggerUserCalendarSync(), {
      wrapper,
    });

    await expect(result.current.triggerUserCalendarSync(42)).rejects.toThrow(
      'Admin sync failed'
    );
  });
});
