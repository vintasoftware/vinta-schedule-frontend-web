import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useDownloadEventIcs } from './use-download-event-ics';

// Mock the generated SDK function and the download util.
const calendarEventsIcsRetrieve = vi.fn();
vi.mock('@/client/sdk.gen', () => ({
  calendarEventsIcsRetrieve: (...args: unknown[]) =>
    calendarEventsIcsRetrieve(...args),
}));

const downloadBlob = vi.fn();
vi.mock('@/lib/utils/download-blob', () => ({
  downloadBlob: (...args: unknown[]) => downloadBlob(...args),
  // Real-ish slug behaviour so we can assert the filename.
  slugifyFilename: (value: string, fallback = 'download') =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback,
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useDownloadEventIcs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the ICS blob and triggers a download named from the title', async () => {
    const blob = new Blob(['BEGIN:VCALENDAR'], { type: 'text/calendar' });
    calendarEventsIcsRetrieve.mockResolvedValue({ data: blob });

    const { result } = renderHook(() => useDownloadEventIcs(), { wrapper });

    await result.current.downloadEventIcs(123, 'Team Sync');

    expect(calendarEventsIcsRetrieve).toHaveBeenCalledWith({
      path: { id: '123' },
      parseAs: 'blob',
      throwOnError: true,
    });
    expect(downloadBlob).toHaveBeenCalledWith(blob, 'team-sync.ics');
  });

  it('falls back to event-<id> when no title is given', async () => {
    calendarEventsIcsRetrieve.mockResolvedValue({ data: new Blob(['x']) });

    const { result } = renderHook(() => useDownloadEventIcs(), { wrapper });

    await result.current.downloadEventIcs(7);

    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'event-7.ics');
  });

  it('propagates errors from the SDK call', async () => {
    calendarEventsIcsRetrieve.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useDownloadEventIcs(), { wrapper });

    await expect(result.current.downloadEventIcs(1, 'x')).rejects.toThrow(
      'boom'
    );
    expect(downloadBlob).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(result.current.downloadEventIcsMutation.isError).toBe(true)
    );
  });
});
