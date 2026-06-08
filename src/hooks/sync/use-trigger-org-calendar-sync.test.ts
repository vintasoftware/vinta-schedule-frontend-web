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

const mockOrg = (organization: unknown) =>
  vi.mocked(orgHook.useCurrentOrganization).mockReturnValue({
    organization,
    isOnboarded: organization != null,
    isGated: false,
    isDisabled: false,
    membership: null,
    role: null,
    query: { data: undefined },
  } as unknown as ReturnType<typeof orgHook.useCurrentOrganization>);

describe('useTriggerOrgCalendarSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Fixed default window for the sync-calendars step.
    const mockNow = {
      minus: () => ({
        startOf: () => ({ toISO: () => '2024-05-05T00:00:00+00:00' }),
      }),
      plus: () => ({
        endOf: () => ({ toISO: () => '2024-09-05T23:59:59+00:00' }),
      }),
    };
    vi.mocked(DateTime.now).mockReturnValue(
      mockNow as unknown as ReturnType<typeof DateTime.now>
    );
  });

  it('runs request-import first, then sync-calendars (in order)', async () => {
    mockOrg({ id: 42, name: 'Test Org' });

    const calls: string[] = [];
    const mockImport = vi.fn().mockImplementation(async () => {
      calls.push('import');
      return { detail: 'ok' };
    });
    const mockSync = vi.fn().mockImplementation(async () => {
      calls.push('sync');
      return { id: 1 };
    });
    vi.mocked(sdk.calendarRequestImportCreate).mockImplementation(
      mockImport as unknown as typeof sdk.calendarRequestImportCreate
    );
    vi.mocked(sdk.organizationsSyncCalendarsCreate).mockImplementation(
      mockSync as unknown as typeof sdk.organizationsSyncCalendarsCreate
    );

    const { result } = renderHook(() => useTriggerOrgCalendarSync(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.triggerOrgCalendarSync).toBeDefined();
    });

    await result.current.triggerOrgCalendarSync();

    // Order: import resolves before sync fires.
    expect(calls).toEqual(['import', 'sync']);

    // Step 1: request-import with the org name as the body, no path.
    expect(mockImport).toHaveBeenCalledTimes(1);
    expect(mockImport).toHaveBeenCalledWith(
      expect.objectContaining({ body: { name: 'Test Org' } })
    );
    expect(mockImport.mock.calls[0][0]).not.toHaveProperty('path');

    // Step 2: sync-calendars with the org id path + default window body.
    expect(mockSync).toHaveBeenCalledTimes(1);
    expect(mockSync).toHaveBeenCalledWith(
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

  it('does NOT run sync-calendars if request-import fails', async () => {
    mockOrg({ id: 42, name: 'Test Org' });

    const mockImport = vi.fn().mockRejectedValue(new Error('import failed'));
    const mockSync = vi.fn().mockResolvedValue({ id: 1 });
    vi.mocked(sdk.calendarRequestImportCreate).mockImplementation(
      mockImport as unknown as typeof sdk.calendarRequestImportCreate
    );
    vi.mocked(sdk.organizationsSyncCalendarsCreate).mockImplementation(
      mockSync as unknown as typeof sdk.organizationsSyncCalendarsCreate
    );

    const { result } = renderHook(() => useTriggerOrgCalendarSync(), {
      wrapper,
    });

    await expect(result.current.triggerOrgCalendarSync()).rejects.toThrow(
      'import failed'
    );
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('throws if organization is not loaded (neither op runs)', async () => {
    mockOrg(null);

    const mockImport = vi.fn().mockResolvedValue({ detail: 'ok' });
    const mockSync = vi.fn().mockResolvedValue({ id: 1 });
    vi.mocked(sdk.calendarRequestImportCreate).mockImplementation(
      mockImport as unknown as typeof sdk.calendarRequestImportCreate
    );
    vi.mocked(sdk.organizationsSyncCalendarsCreate).mockImplementation(
      mockSync as unknown as typeof sdk.organizationsSyncCalendarsCreate
    );

    const { result } = renderHook(() => useTriggerOrgCalendarSync(), {
      wrapper,
    });

    await expect(result.current.triggerOrgCalendarSync()).rejects.toThrow(
      'Organization not loaded'
    );
    expect(mockImport).not.toHaveBeenCalled();
    expect(mockSync).not.toHaveBeenCalled();
  });
});
