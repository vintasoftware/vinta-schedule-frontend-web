import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { useTriggerOrgCalendarSync } from './use-trigger-org-calendar-sync';
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
  });

  it('requests a calendar import with the org name as the body (no path)', async () => {
    mockOrg({ id: 42, name: 'Test Org' });

    const mockImport = vi.fn().mockResolvedValue({ detail: 'ok' });
    vi.mocked(sdk.calendarRequestImportCreate).mockImplementation(
      mockImport as unknown as typeof sdk.calendarRequestImportCreate
    );

    const { result } = renderHook(() => useTriggerOrgCalendarSync(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.triggerOrgCalendarSync).toBeDefined();
    });

    await result.current.triggerOrgCalendarSync();

    // request-import already syncs every calendar by default — no separate
    // organizations/{id}/sync-calendars call.
    expect(mockImport).toHaveBeenCalledTimes(1);
    expect(mockImport).toHaveBeenCalledWith(
      expect.objectContaining({ body: { name: 'Test Org' } })
    );
    expect(mockImport.mock.calls[0][0]).not.toHaveProperty('path');
    expect(sdk.organizationsSyncCalendarsCreate).not.toHaveBeenCalled();
  });

  it('propagates the error when request-import fails', async () => {
    mockOrg({ id: 42, name: 'Test Org' });

    const mockImport = vi.fn().mockRejectedValue(new Error('import failed'));
    vi.mocked(sdk.calendarRequestImportCreate).mockImplementation(
      mockImport as unknown as typeof sdk.calendarRequestImportCreate
    );

    const { result } = renderHook(() => useTriggerOrgCalendarSync(), {
      wrapper,
    });

    await expect(result.current.triggerOrgCalendarSync()).rejects.toThrow(
      'import failed'
    );
  });

  it('throws if organization is not loaded (import never runs)', async () => {
    mockOrg(null);

    const mockImport = vi.fn().mockResolvedValue({ detail: 'ok' });
    vi.mocked(sdk.calendarRequestImportCreate).mockImplementation(
      mockImport as unknown as typeof sdk.calendarRequestImportCreate
    );

    const { result } = renderHook(() => useTriggerOrgCalendarSync(), {
      wrapper,
    });

    await expect(result.current.triggerOrgCalendarSync()).rejects.toThrow(
      'Organization not loaded'
    );
    expect(mockImport).not.toHaveBeenCalled();
  });
});
